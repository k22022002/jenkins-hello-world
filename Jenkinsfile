pipeline {
    agent any

    environment {
        ARTIFACT_NAME = "jenkins-hello-world-${BUILD_NUMBER}.tgz"
        PROVENANCE_FILE = "provenance.json"
        SIGNATURE_FILE = "${ARTIFACT_NAME}.sig"
        // Password giả lập cho Cosign
        COSIGN_PASSWORD = "my-secure-password" 
    }

    tools {
        nodejs 'NodeJS' 
    }

    stages {
        stage('1. Checkout & Clean') {
            steps {
                echo '--- [Prep] Cleaning Workspace & Checkout ---'
                // QUAN TRỌNG: Xóa sạch rác của lần build trước (bao gồm cosign.key cũ)
                // Nếu không có lệnh này, Gitleaks sẽ quét thấy key cũ và báo lỗi
                cleanWs() 
                
                checkout scm
                sh 'npm install'
            }
        }
        
        stage('2. Advanced Secret Scanning (DSOMM L2)') {
            steps {
                echo '--- [DSOMM L2] Deep Secret Detection ---'
                script {
                    // Quét code hiện tại. Vì đã cleanWs() nên sẽ không còn cosign.key cũ
                    try {
                        sh 'docker run --rm -v $(pwd):/path zricethezav/gitleaks:latest detect --source="/path" -v --no-git'
                    } catch (Exception e) {
                        echo "ALARM: Gitleaks found secrets!"
                        // Đánh dấu thất bại nếu tìm thấy secret thật sự trong code source
                        currentBuild.result = 'FAILURE'
                        error("Pipeline stopped due to secret detection.")
                    }
                }
            }
        }

        stage('3. SCA - OWASP Dependency Check (DSOMM L1)') {
            steps {
                echo '--- [DSOMM] Software Composition Analysis ---'
                dependencyCheck additionalArguments: '--format HTML --format XML --failOnCVSS 7.0', 
                                odcInstallation: 'OWASP-Dependency-Check'
            }
            post {
                always {
                    dependencyCheckPublisher pattern: 'dependency-check-report.xml'
                }
            }
        }

        stage('4. SAST - Code Quality (DSOMM L1)') {
            steps {
                script {
                    echo '--- [DSOMM] Static Analysis ---'
                    def nodePath = sh(script: "which node", returnStdout: true).trim()
                    withSonarQubeEnv('SonarCloud') { 
                        sh """
                        npx sonar-scanner \
                            -Dsonar.projectKey=k22022002_jenkins-hello-world \
                            -Dsonar.organization=k22022002 \
                            -Dsonar.sources=src \
                            -Dsonar.tests=test \
                            -Dsonar.css.node=true \
                            -Dsonar.host.url=https://sonarcloud.io \
                            -Dsonar.nodejs.executable="${nodePath}"
                        """
                    }
                }
            }
        }

        stage('5. Build Artifact (SLSA Build)') {
            steps {
                echo '--- [SLSA] Build Immutable Artifact ---'
                script {
                    // Dọn dẹp cục bộ để đảm bảo npm pack lấy đúng file
                    sh 'rm -f *.tgz *.sig' 
                    sh 'npm test'
                    sh "npm pack"
                    // Di chuyển file tgz vừa tạo thành tên chuẩn
                    sh "mv jenkins-hello-world-*.tgz ${ARTIFACT_NAME}"
                }
            }
        }

        stage('6. Generate Provenance (SLSA)') {
            steps {
                script {
                    echo '--- [SLSA] Generating Provenance ---'
                    def artifactSha256 = sh(script: "sha256sum ${ARTIFACT_NAME} | awk '{print \$1}'", returnStdout: true).trim()
                    def gitCommit = sh(script: "git rev-parse HEAD", returnStdout: true).trim()
                    def gitUrl = sh(script: "git config --get remote.origin.url", returnStdout: true).trim()
                    def buildId = env.BUILD_TAG

                    sh """
                        jq -n \
                        --arg builder "Jenkins-CI" \
                        --arg buildId "$buildId" \
                        --arg gitUrl "$gitUrl" \
                        --arg gitCommit "$gitCommit" \
                        --arg artifact "$ARTIFACT_NAME" \
                        --arg sha256 "$artifactSha256" \
                        '{
                            builder: { id: \$builder },
                            buildType: "https://github.com/npm/cli/commands/pack",
                            invocation: {
                                configSource: { uri: \$gitUrl, digest: { sha1: \$gitCommit }, entryPoint: "Jenkinsfile" },
                                parameters: { buildId: \$buildId }
                            },
                            subject: [{ name: \$artifact, digest: { sha256: \$sha256 } }]
                        }' > ${PROVENANCE_FILE}
                    """
                }
            }
        }

        stage('7. Digital Signature (SLSA L2)') {
            steps {
                script {
                    echo '--- [SLSA L2] Signing Artifact ---'
                    withEnv(['COSIGN_PASSWORD=my-secure-password']) {
                        // 1. Tạo key nếu chưa có
                        sh 'if [ ! -f cosign.key ]; then cosign generate-key-pair; fi'

                        // 2. Ký file (FIX LỖI: Dùng --output-signature thay vì >)
                        sh """
                        cosign sign-blob --yes \
                            --key cosign.key \
                            --bundle cosign.bundle \
                            --tlog-upload=false \
                            --output-signature ${SIGNATURE_FILE} \
                            ${ARTIFACT_NAME}
                        """
                    }
                    echo "Artifact signed successfully."
                }
            }
        }
    }
    post {
        success {
            // Thêm cosign.bundle vào danh sách artifacts
            archiveArtifacts artifacts: "${ARTIFACT_NAME}, ${PROVENANCE_FILE}, ${SIGNATURE_FILE}, cosign.pub, cosign.bundle, dependency-check-report.html", allowEmptyArchive: true
            echo "SUCCESS: Pipeline finished."
        }
        failure {
            echo "Pipeline failed."
        }
    }
}
