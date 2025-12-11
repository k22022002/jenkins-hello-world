pipeline {
    agent {
        docker {
            image 'node:20' 
            args '-u root:root'   
        }
    }

    options {
        skipDefaultCheckout()
    }

    environment {
        ARTIFACT_NAME = "jenkins-hello-world-${BUILD_NUMBER}.tgz"
        PROVENANCE_FILE = "provenance.json"
        SBOM_FILE = "sbom.json"
        SIGNATURE_FILE = "${ARTIFACT_NAME}.sig"
        
        // Cần cả Private Key (để ký) và Public Key (để Verify)
        COSIGN_PASSWORD = credentials('cosign-password-id') 
        SONAR_TOKEN = credentials('sonarcloud-token') 
    }

    stages {
        // --- 1. Set up job & Checkout & Setup Node.js ---
        stage('1. Setup & Checkout') {
            steps {
                script {
                    cleanWs()
                    echo '--- [Step] Set up job & Checkout code ---'
                    sh 'apt-get update && apt-get install -y git curl jq openjdk-17-jre docker.io'
                    sh "git config --global --add safe.directory '*'"
                    checkout scm
                }
            }
        }

        // --- 2. Install Cosign (Theo đúng thứ tự trong ảnh) ---
        stage('2. Install Cosign') {
            steps {
                script {
                    echo '--- [Step] Install Cosign ---'
                    sh 'curl -O -L "https://github.com/sigstore/cosign/releases/download/v2.2.4/cosign-linux-amd64"'
                    sh 'mv cosign-linux-amd64 /usr/local/bin/cosign && chmod +x /usr/local/bin/cosign'
                    sh 'cosign version' // Kiểm tra cài đặt
                }
            }
        }

        // --- 3. Install dependencies ---
        stage('3. Install dependencies') {
            steps {
                script {
                    echo '--- [Step] Install dependencies ---'
                    sh 'npm ci'
                }
            }
        }

        // --- 4. Run security tests (Bao gồm Secret, SCA, SAST, Unit Test) ---
        // Trong ảnh bước này nằm TRƯỚC Build -> Code phải chạy Test trước
        stage('4. Run Security Tests') {
            parallel {
                stage('Deep Secret (Trivy)') {
                    steps {
                        // Check Secret
                        sh 'curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin'
                        sh 'trivy fs --exit-code 1 --severity CRITICAL --no-progress .'
                    }
                }
                stage('SCA (NPM Audit)') {
                    steps {
                        // Check Library Vulnerabilities
                        sh 'npm audit --audit-level=high'
                    }
                }
                stage('SAST & Unit Test (SonarQube)') {
                    steps {
                        script {
                            // Chạy Unit Test để lấy Coverage trước
                            sh 'npm test -- --coverage'

                            // Quét SonarQube
                            sh 'rm -rf .scannerwork .sonarqube'
                            def nodePath = sh(script: "which node", returnStdout: true).trim()
                            withSonarQubeEnv('SonarCloud') {
                                sh """
                                    npx sonarqube-scanner \
                                    -Dsonar.projectKey=k22022002_jenkins-hello-world \
                                    -Dsonar.organization=k22022002 \
                                    -Dsonar.sources=src \
                                    -Dsonar.host.url=https://sonarcloud.io \
                                    -Dsonar.qualitygate.wait=true \
                                    -Dsonar.nodejs.executable="${nodePath}" \
                                    -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info
                                """
                            }
                        }
                    }
                }
            }
        }

        // --- 5. Build application ---
        // Chỉ chạy nếu Security Tests (Bước 4) đã Xanh
        stage('5. Build application') {
            steps {
                script {
                    echo '--- [Step] Build application ---'
                    sh "rm -f *.tgz *.sig ${PROVENANCE_FILE} ${SBOM_FILE}"
                    sh 'npm pack'
                    sh "mv jenkins-hello-world-*.tgz ${ARTIFACT_NAME}"
                    
                    // Tính hash ngay sau khi build
                    env.ARTIFACT_HASH = sh(script: "sha256sum ${ARTIFACT_NAME} | awk '{print \$1}'", returnStdout: true).trim()
                }
            }
        }

        // --- 6. Generate SBOM (Mới thêm để khớp ảnh) ---
        stage('6. Generate SBOM') {
            steps {
                script {
                    echo '--- [Step] Generate SBOM (Software Bill of Materials) ---'
                    // Tạo SBOM dạng CycloneDX bằng Trivy
                    sh 'trivy fs --format cyclonedx --output ${SBOM_FILE} .'
                }
            }
        }

        // --- 7. Sign release artifacts ---
        stage('7. Sign release artifacts') {
            steps {
                script {
                    echo '--- [Step] Sign release artifacts ---'
                    withCredentials([file(credentialsId: 'cosign-private-key', variable: 'COSIGN_KEY')]) {
                        // Ký Artifact (.tgz)
                        sh """
                            cosign sign-blob --yes --key \$COSIGN_KEY --tlog-upload=false --output-signature ${SIGNATURE_FILE} ${ARTIFACT_NAME}
                        """
                        // Ký luôn SBOM (Best Practice)
                        sh """
                            cosign sign-blob --yes --key \$COSIGN_KEY --tlog-upload=false --output-signature ${SBOM_FILE}.sig ${SBOM_FILE}
                        """
                    }
                }
            }
        }

        // --- 8. Verify signatures (Mới thêm để khớp ảnh) ---
        stage('8. Verify signatures') {
            steps {
                script {
                    echo '--- [Step] Verify signatures ---'
                    withCredentials([file(credentialsId: 'cosign-public-key', variable: 'COSIGN_PUB')]) {
                        // Tự kiểm tra lại xem chữ ký vừa tạo có hợp lệ không
                        sh """
                            cosign verify-blob --key \$COSIGN_PUB --signature ${SIGNATURE_FILE} ${ARTIFACT_NAME}
                        """
                        echo "Verification Successful: The artifact is correctly signed."
                    }
                }
            }
        }

        // --- 9. Generate attestation (Provenance) ---
        stage('9. Generate attestation') {
            steps {
                script {
                    echo '--- [Step] Generate attestation (SLSA Provenance) ---'
                    def gitCommit = sh(script: "git rev-parse HEAD", returnStdout: true).trim()
                    def gitUrl = sh(script: "git config --get remote.origin.url", returnStdout: true).trim()
                    def builderId = "https://jenkins.your-company.com/agents/docker-node-20"
                    
                    // Tạo file JSON Provenance
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
                                    parameters: { buildUrl: \$buildUrl }
                                }
                            }
                        }' > ${PROVENANCE_FILE}
                    """
                    
                    // Ký luôn file Attestation này (Optional nhưng nên làm)
                    withCredentials([file(credentialsId: 'cosign-private-key', variable: 'COSIGN_KEY')]) {
                         sh "cosign sign-blob --yes --key \$COSIGN_KEY --tlog-upload=false --output-signature ${PROVENANCE_FILE}.sig ${PROVENANCE_FILE}"
                    }
                }
            }
        }
        
        // --- 10. Upload signed artifacts (Post Action) ---
    }

    post {
        success {
            echo '--- [Step] Upload signed artifacts ---'
            // Lưu tất cả: Artifact, Signature, SBOM, Provenance
            archiveArtifacts artifacts: "${ARTIFACT_NAME}, *.sig, *.json", allowEmptyArchive: true
            echo "PIPELINE COMPLETED SUCCESSFULLY matching the Reference Image."
        }
        failure {
            echo "Pipeline Failed."
        }
        always {
            cleanWs()
        }
    }
}
