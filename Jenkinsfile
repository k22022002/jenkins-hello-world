pipeline {
    agent any

    environment {
        ARTIFACT_NAME   = "jenkins-hello-world-${BUILD_NUMBER}.tgz"
        PROVENANCE_FILE = "provenance.json"
        SIGNATURE_FILE  = "${ARTIFACT_NAME}.sig"
        SBOM_FILE       = "sbom.json"
        // DOCKER_IMAGE dùng cho bước Container Scanning
        DOCKER_IMAGE    = "jenkins-hello-world:${BUILD_NUMBER}"
    }

    tools {
        nodejs 'NodeJS' 
    }

    stages {
        stage('1. Initialize, Test & Check Standards') {
            steps {
                echo '--- [Step] Checkout & Install ---'
                cleanWs()
                checkout scm
                
                script {
                    // 1. Install Cosign
                    sh 'rm -f cosign'
                    sh '''
                        curl -L "https://github.com/sigstore/cosign/releases/download/v2.2.4/cosign-linux-amd64" -o cosign
                        chmod +x cosign
                        export PATH=$PWD:$PATH
                        ./cosign version
                    '''
                    
                    // 2. Install Dependencies
                    sh 'npm ci'

                    // 3. [MỚI] Code Linting (Kiểm tra cú pháp code)
                    // Yêu cầu: package.json phải có script "lint"
                    echo '--- [Step] Running Code Linter ---'
                    try {
                        // Nếu chưa cấu hình lint trong package.json thì comment dòng này lại để tránh lỗi
                        sh 'npm run lint' 
                    } catch (Exception e) {
                        error("Code Linting Failed! Please fix code style issues.")
                    }

                    // 4. Run Test & Generate Coverage
                    echo '--- [Step] Running Unit Tests with Coverage ---'
                    sh 'npm test' 
                }
            }
        }

        stage('2. Security & Quality Gates') {
            parallel {
                stage('Secret Scan (Gitleaks)') {
                    steps {
                        script {
                            try {
                                sh 'docker run --rm -v $(pwd):/path zricethezav/gitleaks:latest detect --source="/path" -v --no-git'
                            } catch (Exception e) {
                                currentBuild.result = 'FAILURE'
                                error("Gitleaks found secrets!")
                            }
                        }
                    }
                }
                
                stage('SCA (Dependency Check)') {
                    steps {
                        echo '--- [Step] Scanning Dependencies ---'
                        dependencyCheck additionalArguments: '--format HTML --format XML --failOnCVSS 7.0', 
                                        odcInstallation: 'OWASP-Dependency-Check'
                    }
                }

                stage('SAST (SonarQube)') {
                    steps {
                        script {
                            def nodePath = sh(script: "which node", returnStdout: true).trim()
                            withSonarQubeEnv('SonarCloud') { 
                                echo '--- [Step] SonarScanner Analysis ---'
                                sh """
                                npx sonar-scanner \
                                    -Dsonar.projectKey=k22022002_jenkins-hello-world \
                                    -Dsonar.organization=k22022002 \
                                    -Dsonar.sources=src \
                                    -Dsonar.tests=test \
                                    -Dsonar.host.url=https://sonarcloud.io \
                                    -Dsonar.nodejs.executable="${nodePath}" \
                                    -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info
                                """
                            }
                            timeout(time: 5, unit: 'MINUTES') {
                                waitForQualityGate abortPipeline: true
                            }
                        }
                    }
                }
            }
        }

        stage('3. Build & Container Scan') {
            steps {
                echo '--- [Step] Build Artifacts & Container ---'
                script {
                    sh 'rm -f *.tgz *.sig' 
                    
                    // 1. Build NPM Artifact (.tgz) - Dùng cho các bước Sign/SBOM phía sau
                    sh "npm pack"
                    sh "mv jenkins-hello-world-*.tgz ${ARTIFACT_NAME}"

                    // 2. [MỚI] Build Docker Image (Yêu cầu có Dockerfile)
                    echo "--- Building Docker Image: ${DOCKER_IMAGE} ---"
                    if (fileExists('Dockerfile')) {
                        sh "docker build --no-cache -t ${DOCKER_IMAGE} ."
                        
                        // 3. [MỚI] Container Scanning (Trivy)
                        // Quét lỗi OS packages và dependencies bên trong container
                        echo '--- Running Trivy Container Scan ---'
                        try {
                            sh """
                                docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
                                -v \$(pwd)/.trivycache:/root/.cache/ \
                                aquasec/trivy:latest image \
                                --exit-code 1 \
                                --severity HIGH,CRITICAL \
                                --no-progress \
                                ${DOCKER_IMAGE}
                            """
                        } catch (Exception e) {
                            echo "Trivy found vulnerabilities!"
                            // Uncomment dòng dưới nếu muốn chặn pipeline khi có lỗi Container
                            // error("Pipeline failed due to Container Vulnerabilities")
                        }
                    } else {
                        echo "WARNING: Dockerfile not found. Skipping Container Build & Scan."
                    }
                }
            }
        }

        stage('4. Generate SBOM') {
            steps {
                echo '--- [Step] Generate SBOM (CycloneDX) ---'
                // Tạo SBOM cho file code gốc (NPM)
                sh "npx @cyclonedx/cyclonedx-npm --output-file ${SBOM_FILE}"
            }
        }
    
        stage('5. Sign Release Artifacts') {
            steps {
                echo '--- [Step] Sign Artifacts using Credentials ---'
                withCredentials([
                    string(credentialsId: 'cosign-password-id', variable: 'COSIGN_PASSWORD'),
                    file(credentialsId: 'cosign-private-key', variable: 'COSIGN_KEY_PATH')
                ]) {
                    script {
                        def cosignCmd = (fileExists('cosign')) ? './cosign' : 'cosign'

                        // Setup Key
                        sh "cp \$COSIGN_KEY_PATH cosign.key"
                        sh "${cosignCmd} public-key --key cosign.key --outfile cosign.pub"

                        // Ký Artifact (.tgz)
                        sh """
                        ${cosignCmd} sign-blob --yes \
                            --key cosign.key \
                            --bundle cosign.bundle \
                            --tlog-upload=false \
                            --output-signature ${SIGNATURE_FILE} \
                            ${ARTIFACT_NAME}
                        """
                        
                        // Ký SBOM (.json)
                        sh """
                        ${cosignCmd} sign-blob --yes \
                            --key cosign.key \
                            --tlog-upload=false \
                            --output-signature ${SBOM_FILE}.sig \
                            ${SBOM_FILE}
                        """
                    }
                }
            }
        }

        stage('6. Verify Signatures') {
            steps {
                echo '--- [Step] Verify Signatures ---'
                script {
                    def cosignCmd = (fileExists('cosign')) ? './cosign' : 'cosign'
                    
                    sh """
                        ${cosignCmd} verify-blob \
                            --key cosign.pub \
                            --signature ${SIGNATURE_FILE} \
                            --insecure-ignore-tlog=true \
                            ${ARTIFACT_NAME}
                    """
                    echo "Signature verification PASSED!"
                }
            }
        }

        stage('7. Generate Attestation') {
            steps {
                echo '--- [Step] Generate Provenance Attestation ---'
                script {
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
        
        stage('8. Upload Signed Artifacts') {
            steps {
                echo '--- [Step] Archiving Artifacts ---'
                archiveArtifacts artifacts: "${ARTIFACT_NAME}, ${PROVENANCE_FILE}, ${SIGNATURE_FILE}, ${SBOM_FILE}, cosign.pub, cosign.bundle, dependency-check-report.html", allowEmptyArchive: true
            }
        }
    }

    post {
        always {
             dependencyCheckPublisher pattern: 'dependency-check-report.xml'
             // Dọn dẹp Docker images để tiết kiệm ổ cứng cho Jenkins Agent
             sh "docker rmi ${DOCKER_IMAGE} || true"
        }
        success {
            echo "SUCCESS: Pipeline finished securely."
        }
        failure {
            echo "Pipeline failed. Please check Security Scans or Quality Gates."
        }
    }
}
