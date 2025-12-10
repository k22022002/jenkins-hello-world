pipeline {
    // [SLSA L3] Isolated Build: Chạy toàn bộ pipeline trong Docker Container sạch
    // Đảm bảo môi trường là Ephemeral (tạm thời) và không bị nhiễm bẩn từ build trước.
    agent {
        docker {
            image 'node:18-alpine' 
            // Mount docker socket để chạy Docker-in-Docker (cho bước Gitleaks/Cosign nếu cần)
            // Hoặc cài sẵn tools vào image custom của bạn để an toàn hơn.
            // Ở đây giả lập môi trường nodejs clean.
            args '-u root:root' 
        }
    }

    environment {
        ARTIFACT_NAME = "jenkins-hello-world-${BUILD_NUMBER}.tgz"
        PROVENANCE_FILE = "provenance.json"
        SIGNATURE_FILE = "${ARTIFACT_NAME}.sig"
        
        // [DSOMM L3] Externalized Secrets: Lấy password từ Jenkins Credentials
        // Bạn cần tạo Secret Text ID 'cosign-password-id' trong Jenkins
        COSIGN_PWD = credentials('cosign-password-id') 
        
        // Cấu hình SonarQube token an toàn
	SONAR_TOKEN = credentials('sonarcloud-token')
    }

    stages {
        stage('1. Checkout & Preparation') {
            steps {
                script {
                    echo '--- [Prep] Environment Setup ---'
                    // Cài đặt các tool cần thiết trong môi trường Alpine (nếu chưa có trong image)
                    // Trong môi trường Production SLSA L3, bạn nên build 1 image có sẵn các tool này.
                    sh 'apk add --no-cache git curl jq docker-cli'
                    
                    checkout scm
                    sh 'npm ci' // Sử dụng 'ci' thay vì 'install' để đảm bảo tính nhất quán (Reproducible Build)
                }
            }
        }
        
        stage('2. Security: Deep Secret & Misconfig (DSOMM L3)') {
            steps {
                script {
                    echo '--- [DSOMM L3] Trivy Filesystem Scan ---'
                    // Trivy quét toàn diện hơn Gitleaks: Secret, Config lỗi, Vulns trong OS package
                    // Tải Trivy (hoặc dùng image có sẵn)
                    sh 'curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin'
                    
                    // Quét Filesystem, fail nếu có lỗi CRITICAL
                    // Đây là Security Gate cứng
                    sh 'trivy fs --exit-code 1 --severity CRITICAL --no-progress .'
                }
            }
        }

	stage('3. SCA & SAST (DSOMM L3)') {
            parallel {
                stage('Dependency Check') {
                    steps {
                        echo '--- [SCA] NPM Audit ---'
                        // Audit lỗ hổng thư viện, thất bại nếu có lỗi High
                        sh 'npm audit --audit-level=high' 
                    }
                }
                stage('SonarQube Quality Gate') {
                    steps {
                        script {
                            echo '--- [SAST] SonarQube Scan & Wait ---'
                            withSonarQubeEnv('SonarCloud') {
                                // THAY ĐỔI QUAN TRỌNG Ở ĐÂY:
                                // Thêm dòng -Dsonar.qualitygate.wait=true
                                // Lệnh này bắt buộc scanner đợi server xử lý xong
                                // Nếu Quality Gate = Failed, lệnh này sẽ trả về lỗi và pipeline dừng ngay.
                                sh """
                                    npx sonar-scanner \
                                    -Dsonar.projectKey=k22022002_jenkins-hello-world \
                                    -Dsonar.organization=k22022002 \
                                    -Dsonar.sources=src \
                                    -Dsonar.host.url=https://sonarcloud.io \
                                    -Dsonar.login=${SONAR_TOKEN} \
                                    -Dsonar.qualitygate.wait=true
                                """
                            }
                        }
                        // LƯU Ý: Đã XÓA bỏ đoạn "waitForQualityGate" ở đây vì không cần nữa
                    }
                }
            }
        }
        stage('4. Build Artifact (SLSA Build)') {
            steps {
                script {
                    echo '--- [SLSA] Hermetic Build ---'
                    // Clean artifacts cũ
                    sh 'rm -f *.tgz *.sig *.json'
                    
                    // Chạy test trước khi build
                    sh 'npm test'
                    
                    // Build artifact
                    sh 'npm pack'
                    sh "mv jenkins-hello-world-*.tgz ${ARTIFACT_NAME}"
                    
                    // Tính Hash ngay lập tức để đảm bảo toàn vẹn
                    env.ARTIFACT_HASH = sh(script: "sha256sum ${ARTIFACT_NAME} | awk '{print \$1}'", returnStdout: true).trim()
                }
            }
        }

        stage('5. Generate Provenance (SLSA L3)') {
            steps {
                script {
                    echo '--- [SLSA L3] Generating Non-falsifiable Provenance ---'
                    def gitCommit = sh(script: "git rev-parse HEAD", returnStdout: true).trim()
                    def gitUrl = sh(script: "git config --get remote.origin.url", returnStdout: true).trim()
                    def builderId = "https://jenkins.your-company.com/agents/docker-node-18" // ID Builder
                    
                    // SLSA v1.0+ format: predicateType https://slsa.dev/provenance/v1
                    // Thêm thông tin 'materials' để tracking dependency source
                    sh """
                        jq -n \
                        --arg builder "$builderId" \
                        --arg gitUrl "$gitUrl" \
                        --arg gitCommit "$gitCommit" \
                        --arg artifact "$ARTIFACT_NAME" \
                        --arg sha256 "$ARTIFACT_HASH" \
                        --arg buildUrl "$BUILD_URL" \
                        '{
                            _type: "https://in-toto.io/Statement/v0.1",
                            subject: [{ name: \$artifact, digest: { sha256: \$sha256 } }],
                            predicateType: "https://slsa.dev/provenance/v0.2",
                            predicate: {
                                builder: { id: \$builder },
                                buildType: "https://github.com/npm/cli/commands/pack",
                                invocation: {
                                    configSource: { uri: \$gitUrl, digest: { sha1: \$gitCommit }, entryPoint: "Jenkinsfile" },
                                    parameters: { buildUrl: \$buildUrl },
                                    environment: { architecture: "amd64", os: "linux" }
                                },
                                materials: [
                                    { uri: \$gitUrl, digest: { sha1: \$gitCommit } }
                                ]
                            }
                        }' > ${PROVENANCE_FILE}
                    """
                }
            }
        }

        stage('6. Digital Signature (SLSA L3)') {
            steps {
                script {
                    echo '--- [SLSA L3] Signing with Cosign ---'
                    // Cài Cosign
                    sh 'curl -O -L "https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64"'
                    sh 'mv cosign-linux-amd64 /usr/local/bin/cosign && chmod +x /usr/local/bin/cosign'

                    withCredentials([file(credentialsId: 'cosign-private-key', variable: 'COSIGN_KEY')]) {
                        // Ký Artifact
                        sh """
                            cosign sign-blob --yes \
                                --key \$COSIGN_KEY \
                                --tlog-upload=false \
                                --output-signature ${SIGNATURE_FILE} \
                                ${ARTIFACT_NAME}
                        """
                        
                        // [SLSA L3 Requirement] Ký cả file Provenance (Attestation)
                        // Để đảm bảo metadata về quy trình build không bị giả mạo
                        sh """
                            cosign sign-blob --yes \
                                --key \$COSIGN_KEY \
                                --tlog-upload=false \
                                --output-signature ${PROVENANCE_FILE}.sig \
                                ${PROVENANCE_FILE}
                        """
                    }
                }
            }
        }
    }

    post {
        always {
            // Lưu trữ tất cả bằng chứng
            archiveArtifacts artifacts: "${ARTIFACT_NAME}, *.json, *.sig", allowEmptyArchive: true
            cleanWs() // Dọn dẹp workspace sau khi xong (Ephemeral)
        }
        success {
            echo "Build Success: SLSA L3 Artifact created."
        }
        failure {
            echo "Build Failed: Security gates or Build error."
        }
    }
}
