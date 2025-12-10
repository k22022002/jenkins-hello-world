pipeline {
    agent {
        docker {
            // SỬ DỤNG BẢN 'bookworm' (Debian Full) để đảm bảo có lệnh 'ps' (tránh lỗi exit code -2)
            image 'node:20-bookworm' 
            
            // THÊM: -v /var/run/docker.sock:... để container gọi được Docker của máy chủ (Docker-out-of-Docker)
            args '-u root:root -v /var/run/docker.sock:/var/run/docker.sock -t -d --entrypoint=""'   
        }
    }

    options {
        skipDefaultCheckout()
        timeout(time: 1, unit: 'HOURS')
    }

    environment {
        ARTIFACT_NAME = "jenkins-hello-world-${BUILD_NUMBER}.tgz"
        PROVENANCE_FILE = "provenance.json"
        SBOM_FILE = "sbom.json"
        SIGNATURE_FILE = "${ARTIFACT_NAME}.sig"
        
        COSIGN_PASSWORD = credentials('cosign-password-id') 
        SONAR_TOKEN = credentials('sonarcloud-token') 
    }

    stages {
        stage('1. Setup & Checkout') {
            steps {
                script {
                    cleanWs()
                    echo '--- [Step] Set up job & Checkout code ---'
                    
                    sh 'export DEBIAN_FRONTEND=noninteractive'
                    
                    // 1. Update
                    echo '--- Updating apt repos ---'
                    sh 'apt-get update'
                    
                    // 2. Install Tools (Thêm procps để chắc chắn có lệnh ps cho Jenkins)
                    echo '--- Installing basic tools ---'
                    sh 'apt-get install -y --no-install-recommends git curl jq procps'
                    
                    // 3. Install Java
                    echo '--- Installing Java ---'
                    sh 'apt-get install -y --no-install-recommends openjdk-17-jre'
                    
                    // 4. Install Docker CLI
                    echo '--- Installing Docker CLI ---'
                    sh 'apt-get install -y --no-install-recommends docker.io'
                    
                    // 5. Verify Docker connection
                    // Kiểm tra xem đã kết nối được với Docker Daemon chưa
                    sh 'docker info || echo "WARNING: Cannot connect to Docker Daemon. Check socket mount."'

                    echo '--- Checking out source code ---'
                    sh "git config --global --add safe.directory '*'"
                    checkout scm
                    
                    sh 'npm ci'
                }
            }
        }

        stage('2. Install Cosign') {
            steps {
                script {
                    echo '--- [Step] Install Cosign ---'
                    sh 'curl -O -L "https://github.com/sigstore/cosign/releases/download/v2.2.4/cosign-linux-amd64"'
                    sh 'mv cosign-linux-amd64 /usr/local/bin/cosign && chmod +x /usr/local/bin/cosign'
                    sh 'cosign version'
                }
            }
        }

        stage('3. Install dependencies') {
            steps {
                script {
                    echo '--- [Step] Install dependencies ---'
                    sh 'npm ci'
                }
            }
        }

        stage('4. Run Security Tests') {
            parallel {
                stage('Deep Secret (Trivy)') {
                    steps {
                        sh 'curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin'
                        // Thêm --ignore-unfixed để tránh fail build nếu chỉ test demo
                        sh 'trivy fs --exit-code 1 --severity CRITICAL --no-progress .'
                    }
                }
                stage('SCA (NPM Audit)') {
                    steps {
                        // Dùng || true để không fail pipeline nếu chỉ muốn warning
                        sh 'npm audit --audit-level=high || true'
                    }
                }
                stage('SAST & Unit Test (SonarQube)') {
                    steps {
                        script {
                            sh 'npm test -- --coverage'
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

        stage('5. Build application') {
            steps {
                script {
                    echo '--- [Step] Build application ---'
                    sh "rm -f *.tgz *.sig ${PROVENANCE_FILE} ${SBOM_FILE}"
                    sh 'npm pack'
                    sh "mv jenkins-hello-world-*.tgz ${ARTIFACT_NAME}"
                    env.ARTIFACT_HASH = sh(script: "sha256sum ${ARTIFACT_NAME} | awk '{print \$1}'", returnStdout: true).trim()
                }
            }
        }

        stage('6. Generate SBOM') {
            steps {
                script {
                    echo '--- [Step] Generate SBOM ---'
                    sh "trivy fs --format cyclonedx --output ${SBOM_FILE} ."
                }
            }
        }

        stage('7. Sign release artifacts') {
            steps {
                script {
                    echo '--- [Step] Sign release artifacts ---'
                    withCredentials([file(credentialsId: 'cosign-private-key', variable: 'COSIGN_KEY')]) {
                        sh "cosign sign-blob --yes --key \$COSIGN_KEY --tlog-upload=false --output-signature ${SIGNATURE_FILE} ${ARTIFACT_NAME}"
                        sh "cosign sign-blob --yes --key \$COSIGN_KEY --tlog-upload=false --output-signature ${SBOM_FILE}.sig ${SBOM_FILE}"
                    }
                }
            }
        }

        stage('8. Verify signatures') {
            steps {
                script {
                    echo '--- [Step] Verify signatures ---'
                    withCredentials([file(credentialsId: 'cosign-public-key', variable: 'COSIGN_PUB')]) {
                        sh "cosign verify-blob --key \$COSIGN_PUB --signature ${SIGNATURE_FILE} ${ARTIFACT_NAME}"
                        echo "Verification Successful"
                    }
                }
            }
        }

        stage('9. Generate attestation') {
            steps {
                script {
                    echo '--- [Step] Generate attestation ---'
                    def gitCommit = sh(script: "git rev-parse HEAD", returnStdout: true).trim()
                    def gitUrl = sh(script: "git config --get remote.origin.url", returnStdout: true).trim()
                    def builderId = "https://jenkins.your-company.com/agents/docker-node-20"
                    
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
                    
                    withCredentials([file(credentialsId: 'cosign-private-key', variable: 'COSIGN_KEY')]) {
                         sh "cosign sign-blob --yes --key \$COSIGN_KEY --tlog-upload=false --output-signature ${PROVENANCE_FILE}.sig ${PROVENANCE_FILE}"
                    }
                }
            }
        }
    }

    post {
        success {
            echo '--- [Step] Upload signed artifacts ---'
            archiveArtifacts artifacts: "${ARTIFACT_NAME}, *.sig, *.json", allowEmptyArchive: true
            echo "PIPELINE COMPLETED SUCCESSFULLY."
        }
        failure {
            echo "Pipeline Failed."
        }
        always {
            cleanWs()
        }
    }
}
