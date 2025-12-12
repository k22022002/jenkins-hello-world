pipeline {
    agent any

    environment {
        ARTIFACT_NAME   = "jenkins-hello-world-${BUILD_NUMBER}.tgz"
        PROVENANCE_FILE = "provenance.json"
        SIGNATURE_FILE  = "${ARTIFACT_NAME}.sig"
        SBOM_FILE       = "sbom.json"
        // Đã xóa COSIGN_PASSWORD cứng ở đây để bảo mật
    }

    tools {
        nodejs 'NodeJS' 
    }

    stages {
        stage('1. Initialize, Test & Coverage') {
            steps {
                echo '--- [Step] Checkout, Install & Unit Test ---'
                cleanWs()
                checkout scm
                
                script {
                    // 1. Install Cosign (Logic giữ nguyên)
                    sh 'rm -f cosign'
                    sh '''
                        echo "Downloading Cosign..."
                        curl -L "https://github.com/sigstore/cosign/releases/download/v2.2.4/cosign-linux-amd64" -o cosign
                        chmod +x cosign
                        if file cosign | grep -q "HTML"; then
                            echo "ERROR: Downloaded file is HTML, not binary."
                            exit 1
                        fi
                        export PATH=$PWD:$PATH
                        ./cosign version
                    '''
                    
                    // 2. Install Dependencies
                    sh 'npm install'

                    // 3. Run Test & Generate Coverage (Shift-left)
                    // Lệnh này chạy script "test" trong package.json (đã cấu hình Jest coverage)
                    // Kết quả tạo ra thư mục coverage/lcov.info
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
                        // failOnCVSS 7.0: Pipeline sẽ fail nếu tìm thấy lỗi bảo mật mức High/Critical
                        dependencyCheck additionalArguments: '--format HTML --format XML --failOnCVSS 7.0', 
                                        odcInstallation: 'OWASP-Dependency-Check'
                    }
                }

                stage('SAST (SonarQube)') {
                    steps {
                        script {
                            def nodePath = sh(script: "which node", returnStdout: true).trim()
                            // Lưu ý: Cần đảm bảo cấu hình 'SonarCloud' trong Jenkins System trỏ tới credential 'sonarcloud-token'
                            withSonarQubeEnv('SonarCloud') { 
                                echo '--- [Step] SonarScanner Analysis ---'
                                // Thêm tham số sonar.javascript.lcov.reportPaths để đọc coverage từ Stage 1
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
                            
                            // Quality Gate: Chặn pipeline nếu code không đạt chuẩn (ví dụ: Coverage < 80%)
                            echo '--- [Step] Checking Quality Gate ---'
                            timeout(time: 5, unit: 'MINUTES') {
                                waitForQualityGate abortPipeline: true
                            }
                        }
                    }
                }
            }
        }

        stage('3. Build Application') {
            steps {
                echo '--- [Step] Build Application ---'
                script {
                    sh 'rm -f *.tgz *.sig' 
                    // Đã bỏ 'npm test' ở đây vì đã chạy ở Stage 1
                    sh "npm pack"
                    sh "mv jenkins-hello-world-*.tgz ${ARTIFACT_NAME}"
                }
            }
        }

        stage('4. Generate SBOM') {
            steps {
                echo '--- [Step] Generate SBOM (CycloneDX) ---'
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

                        // 1. Setup Key
                        sh "cp \$COSIGN_KEY_PATH cosign.key"
                        sh "${cosignCmd} public-key --key cosign.key --outfile cosign.pub"

                        // 2. Ký Artifact (.tgz)
                        sh """
                        ${cosignCmd} sign-blob --yes \
                            --key cosign.key \
                            --bundle cosign.bundle \
                            --tlog-upload=false \
                            --output-signature ${SIGNATURE_FILE} \
                            ${ARTIFACT_NAME}
                        """
                        
                        // 3. Ký SBOM (.json)
                        sh """
                        ${cosignCmd} sign-blob --yes \
                            --key cosign.key \
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
        }
        success {
            echo "SUCCESS: Pipeline finished securely."
        }
        failure {
            echo "Pipeline failed. Please check Security Scans or Quality Gates."
        }
    }
}
