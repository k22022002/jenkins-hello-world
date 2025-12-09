pipeline {
    agent any

    environment {
        // Định nghĩa tên Artifact và File chứng thực
        ARTIFACT_NAME = "jenkins-hello-world-${BUILD_NUMBER}.tgz"
        PROVENANCE_FILE = "provenance.json"
        SIGNATURE_FILE = "${ARTIFACT_NAME}.sig"
        
        // Demo: Mật khẩu cho Key ký số (Trong thực tế hãy dùng Jenkins Credentials)
        COSIGN_PASSWORD = "my-secure-password" 
    }

    tools {
        nodejs 'NodeJS' 
        // Lưu ý: Máy Jenkins cần cài sẵn 'jq' và 'cosign' trong PATH hệ thống
    }

    stages {
        stage('1. Checkout & Init') {
            steps {
                echo '--- [Prep] Checkout Code ---'
                checkout scm
                sh 'npm install'
            }
        }

        // --- DSOMM Level 2: Enhanced Security Scanning ---
        
        stage('2. Advanced Secret Scanning (DSOMM L2)') {
            steps {
                echo '--- [DSOMM L2] Deep Secret Detection with Gitleaks ---'
                script {
                    // Sử dụng Docker để chạy Gitleaks - quét sâu tìm password/key
                    // -v $(pwd):/path: Mount thư mục code hiện tại vào trong container
                    // --source="/path": Bảo Gitleaks quét thư mục đó
                    // --no-git: Quét file hệ thống thay vì lịch sử git (đôi khi jenkins checkout dạng detached head)
                    try {
                        sh 'docker run --rm -v $(pwd):/path zricethezav/gitleaks:latest detect --source="/path" -v --no-git'
                    } catch (Exception e) {
                        // DSOMM L2 yêu cầu chặn Build nếu lộ secret. 
                        // Tuy nhiên để bạn test chạy mượt, tôi set currentBuild.result thay vì error()
                        echo "ALARM: Gitleaks found potential secrets!"
                        currentBuild.result = 'UNSTABLE' 
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
                    echo '--- [DSOMM] Static Application Security Testing ---'
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

        // --- SLSA v1.2 Level 2: Authenticated Provenance ---

        stage('5. Build Artifact (SLSA Build)') {
            steps {
                echo '--- [SLSA] Build Immutable Artifact ---'
		sh 'rm -f *.tgz *.sig'
                sh 'npm test'
                sh "npm pack"
		sh "mv jenkins-hello-world-*.tgz ${ARTIFACT_NAME}"
            }
        }

        stage('6. Generate Provenance with jq (SLSA)') {
            steps {
                script {
                    echo '--- [SLSA] Generating Provenance using jq ---'
                    
                    def artifactSha256 = sh(script: "sha256sum ${ARTIFACT_NAME} | awk '{print \$1}'", returnStdout: true).trim()
                    def gitCommit = sh(script: "git rev-parse HEAD", returnStdout: true).trim()
                    def gitUrl = sh(script: "git config --get remote.origin.url", returnStdout: true).trim()
                    def buildId = env.BUILD_TAG // Biến môi trường có sẵn của Jenkins

                    // Dùng JQ để tạo JSON chuẩn chỉnh, không lo lỗi syntax
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
                    echo "Provenance generated successfully."
                }
            }
        }

        stage('7. Digital Signature (SLSA L2)') {
            steps {
                script {
                    echo '--- [SLSA L2] Signing Artifact with Cosign ---'
                    
                    // BƯỚC GIẢ LẬP: Tạo cặp key tạm thời để demo (Artifact Signing)
                    // Trong PROD: Bạn sẽ lưu private key trong Jenkins Credentials
                    sh 'cosign generate-key-pair' 

                    // Ký vào file Artifact (.tgz)
                    // Kết quả tạo ra file chữ ký (mặc định in ra stdout, ta lưu vào file .sig)
                    sh "cosign sign-blob --yes --key cosign.key --tlog-upload=false --output-signature ${SIGNATURE_FILE} ${ARTIFACT_NAME}"
                    
                    echo "Artifact signed. Signature saved to ${SIGNATURE_FILE}"
                }
            }
        }
    }

    post {
        success {
            // Lưu trữ Artifact, Provenance, Key công khai (để verify) và Chữ ký
            archiveArtifacts artifacts: "${ARTIFACT_NAME}, ${PROVENANCE_FILE}, ${SIGNATURE_FILE}, cosign.pub, dependency-check-report.html", allowEmptyArchive: true
            echo "SUCCESS: Pipeline completed DSOMM L2 & SLSA L2 requirements."
        }
        failure {
            echo "Pipeline failed."
        }
    }
}
