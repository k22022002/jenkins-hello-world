pipeline {
    agent {
        docker {
            image 'node:20' 
            // Added socket mapping so the docker command inside the container can talk to the host
            args '--entrypoint="" -u root:root -v /var/run/docker.sock:/var/run/docker.sock'   
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
        
        // Need both Private Key (to Sign) and Public Key (to Verify)
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
                    // Installing docker.io inside the container so we can use docker CLI
                    sh 'apt-get update && apt-get install -y git curl jq openjdk-17-jre docker.io'
                    sh "git config --global --add safe.directory '*'"
                    checkout scm
                }
            }
        }

        // --- 2. Install Cosign ---
        stage('2. Install Cosign') {
            steps {
                script {
                    echo '--- [Step] Install Cosign ---'
                    sh 'curl -O -L "https://github.com/sigstore/cosign/releases/download/v2.2.4/cosign-linux-amd64"'
                    sh 'mv cosign-linux-amd64 /usr/local/bin/cosign && chmod +x /usr/local/bin/cosign'
                    sh 'cosign version' // Verify installation
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

        // --- 4. Run security tests ---
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
                            // Run Unit Test to get Coverage first
                            sh 'npm test -- --coverage'

                            // Scan SonarQube
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
        stage('5. Build application') {
            steps {
                script {
                    echo '--- [Step] Build application ---'
                    sh "rm -f *.tgz *.sig ${PROVENANCE_FILE} ${SBOM_FILE}"
                    sh 'npm pack'
                    sh "mv jenkins-hello-world-*.tgz ${ARTIFACT_NAME}"
                    
                    // Calculate hash immediately after build
                    env.ARTIFACT_HASH = sh(script: "sha256sum ${ARTIFACT_NAME} | awk '{print \$1}'", returnStdout: true).trim()
                }
            }
        }

        // --- 6. Generate SBOM ---
        stage('6. Generate SBOM') {
            steps {
                script {
                    echo '--- [Step] Generate SBOM (Software Bill of Materials) ---'
                    // Create SBOM in CycloneDX format using Trivy
                    sh "trivy fs --format cyclonedx --output ${SBOM_FILE} ."
                }
            }
        }

        // --- 7. Sign release artifacts ---
        stage('7. Sign release artifacts') {
            steps {
                script {
                    echo '--- [Step] Sign release artifacts ---'
                    withCredentials([file(credentialsId: 'cosign-private-key', variable: 'COSIGN_KEY')]) {
                        // Sign Artifact (.tgz)
                        sh """
                            cosign sign-blob --yes --key \$COSIGN_KEY --tlog-upload=false --output-signature ${SIGNATURE_FILE} ${ARTIFACT_NAME}
                        """
                        // Sign SBOM (Best Practice)
                        sh """
                            cosign sign-blob --yes --key \$COSIGN_KEY --tlog-upload=false --output-signature ${SBOM_FILE}.sig ${SBOM_FILE}
                        """
                    }
                }
            }
        }

        // --- 8. Verify signatures ---
        stage('8. Verify signatures') {
            steps {
                script {
                    echo '--- [Step] Verify signatures ---'
                    withCredentials([file(credentialsId: 'cosign-public-key', variable: 'COSIGN_PUB')]) {
                        // Verify the signature we just created
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
                    
                    // Create JSON Provenance file
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
                    
                    // Sign the Attestation file (Optional but recommended)
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
            // Archive all: Artifact, Signature, SBOM, Provenance
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
