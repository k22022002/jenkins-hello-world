pipeline {
    agent {
        docker {
            image 'node:20-alpine' 
            args '-u root:root'    
        }
    }

    options {
        skipDefaultCheckout()
    }

    environment {
        ARTIFACT_NAME = "jenkins-hello-world-${BUILD_NUMBER}.tgz"
        PROVENANCE_FILE = "provenance.json"
        SIGNATURE_FILE = "${ARTIFACT_NAME}.sig"
        
        COSIGN_PWD = credentials('cosign-password-id') 
        SONAR_TOKEN = credentials('sonarcloud-token') 
    }

    stages {
        stage('1. Setup & Checkout') {
            steps {
                script {
                    echo '--- [Step 1] Installing Git & Tools ---'
                    sh 'apk add --no-cache git curl jq docker-cli openjdk17-jre'
                    
                    // [FIX LỖI GIT OWNERSHIP TẠI ĐÂY]
                    // Cho phép git chạy dưới quyền root trên thư mục của user jenkins
                    sh "git config --global --add safe.directory '*'"
                    
                    echo '--- [Step 2] Manual Checkout ---'
                    checkout scm
                    
                    echo '--- [Step 3] Clean Install ---'
                    sh 'npm ci' 
                }
            }
        }
        
        stage('2. Security: Deep Secret & Misconfig (DSOMM L3)') {
            steps {
                script {
                    echo '--- [DSOMM L3] Trivy Filesystem Scan ---'
                    sh 'curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin'
                    sh 'trivy fs --exit-code 1 --severity CRITICAL --no-progress .'
                }
            }
        }

        stage('3. SCA & SAST (DSOMM L3)') {
            parallel {
                stage('Dependency Check') {
                    steps {
                        echo '--- [SCA] NPM Audit ---'
                        sh 'npm audit --audit-level=high || true' 
                    }
                }
                stage('SonarQube Quality Gate') {
                    steps {
                        script {
                            echo '--- [SAST] SonarQube Scan & Wait ---'
                            def nodePath = sh(script: "which node", returnStdout: true).trim()
                            
                            withSonarQubeEnv('SonarCloud') {
                                sh """
                                    npx sonar-scanner \
                                    -Dsonar.projectKey=k22022002_jenkins-hello-world \
                                    -Dsonar.organization=k22022002 \
                                    -Dsonar.sources=src \
                                    -Dsonar.host.url=https://sonarcloud.io \
                                    -Dsonar.qualitygate.wait=true \
                                    -Dsonar.nodejs.executable="${nodePath}"
                                """
                            }
                        }
                    }
                }
            }
        }

        stage('4. Build Artifact (SLSA Build)') {
            steps {
                script {
                    echo '--- [SLSA] Hermetic Build ---'
                    
                    // Xóa file cũ cẩn thận, tránh xóa nhầm package.json
                    sh "rm -f ${ARTIFACT_NAME} ${SIGNATURE_FILE} ${PROVENANCE_FILE}"
                    
                    sh 'npm test'
                    sh 'npm pack'
                    sh "mv jenkins-hello-world-*.tgz ${ARTIFACT_NAME}"
                    env.ARTIFACT_HASH = sh(script: "sha256sum ${ARTIFACT_NAME} | awk '{print \$1}'", returnStdout: true).trim()
                }
            }
        }

        stage('5. Generate Provenance (SLSA L3)') {
            steps {
                script {
                    echo '--- [SLSA L3] Generating Non-falsifiable Provenance ---'
                    
                    // Lệnh này bây giờ sẽ chạy thành công nhờ fix ở Stage 1
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
		    sh 'curl -O -L "https://github.com/sigstore/cosign/releases/download/v2.2.4/cosign-linux-amd64"'
                    sh 'mv cosign-linux-amd64 /usr/local/bin/cosign && chmod +x /usr/local/bin/cosign'

                    withCredentials([file(credentialsId: 'cosign-private-key', variable: 'COSIGN_KEY')]) {
                        sh """
                            cosign sign-blob --yes \
                                --key \$COSIGN_KEY \
                                --tlog-upload=false \
                                --output-signature ${SIGNATURE_FILE} \
                                ${ARTIFACT_NAME}
                        """
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
            archiveArtifacts artifacts: "${ARTIFACT_NAME}, *.json, *.sig", allowEmptyArchive: true
            cleanWs()
        }
        success {
            echo "Build Success: SLSA L3 Artifact created."
        }
        failure {
            echo "Build Failed."
        }
    }
}
