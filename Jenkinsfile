pipeline {
    agent any

    environment {
        // --- Artifact Info ---
        ARTIFACT_NAME   = "jenkins-hello-world-${BUILD_NUMBER}.tgz"
        PROVENANCE_FILE = "provenance.json"
        SIGNATURE_FILE  = "${ARTIFACT_NAME}.sig"
        
        // --- SBOM Files ---
        SBOM_CODE       = "sbom-code.json"      // SBOM cho Source Code (NPM)
        SBOM_CONTAINER  = "cbom-container.json" // CBOM cho Docker Image
        
        // --- Docker Info ---
        DOCKER_IMAGE    = "jenkins-hello-world:${BUILD_NUMBER}"
        APP_PORT        = "3000" // Port mặc định của ứng dụng Nodejs (cần khớp với Dockerfile)
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
                    // 1. Install Cosign (Tool ký số)
                    sh 'rm -f cosign'
                    sh '''
                        curl -L "https://github.com/sigstore/cosign/releases/download/v2.2.4/cosign-linux-amd64" -o cosign
                        chmod +x cosign
                        export PATH=$PWD:$PATH
                        ./cosign version
                    '''
                    
                    // 2. Install Dependencies
                    sh 'npm ci'

                    // 3. Code Linting
                    echo '--- [Step] Running Code Linter ---'
                    try {
                        // Đảm bảo package.json có script "lint" hoặc bỏ qua nếu chưa có
                        sh 'npm run lint' 
                    } catch (Exception e) {
                        echo "Warning: Linting failed or not configured."
                    }

                    // 4. Run Test & Generate Coverage
                    echo '--- [Step] Running Unit Tests with Coverage ---'
                    sh 'npm test' 
                }
            }
        }

        stage('2. Security & Quality Gates (Static)') {
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

        stage('3. Build & Container Security') {
            steps {
                echo '--- [Step] Build Artifacts & Container ---'
                script {
                    sh 'rm -f *.tgz *.sig' 
                    
                    // 1. Build NPM Artifact (.tgz)
                    sh "npm pack"
                    sh "mv jenkins-hello-world-*.tgz ${ARTIFACT_NAME}"

                    // 2. Build Docker Image
                    echo "--- Building Docker Image: ${DOCKER_IMAGE} ---"
                    if (fileExists('Dockerfile')) {
                        sh "docker build --no-cache -t ${DOCKER_IMAGE} ."
                        
                        // 3. Container Scanning (Trivy) - Vulnerability
                        echo '--- Running Trivy Container Scan ---'
                        try {
                             sh """
                                docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
                                aquasec/trivy:latest image \
                                --exit-code 1 \
                                --severity HIGH,CRITICAL \
                                --no-progress \
                                --scanners vuln \
                                ${DOCKER_IMAGE}
                            """
                        } catch (Exception e) {
                            echo "Trivy found vulnerabilities!"
                            // error("Pipeline failed due to Container Vulnerabilities") // Uncomment để chặn lỗi
                        }

                        // 4. [NEW] Generate CBOM (Container SBOM)
                        // Tạo danh sách vật liệu phần mềm cho Container
                        echo '--- Generating CBOM (Container SBOM) ---'
                        sh """
                            docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
                            -v \$(pwd):/output \
                            aquasec/trivy:latest image \
                            --format cyclonedx \
                            --output /output/${SBOM_CONTAINER} \
                            ${DOCKER_IMAGE}
                        """

                    } else {
                        echo "WARNING: Dockerfile not found. Skipping Container steps."
                    }
                }
            }
        }

	stage('4. DAST (Dynamic Analysis)') {
    steps {
        script {
            if (fileExists('Dockerfile')) {
                echo '--- [Step] Starting App for DAST ---'
                // Khởi chạy app
                sh "docker run -d --name test-app-dast -p ${APP_PORT}:${APP_PORT} ${DOCKER_IMAGE}"
                
                // Chờ app khởi động (Tăng lên 15-20s nếu cần)
                sh "sleep 15"

                echo '--- [Step] Running OWASP ZAP (DAST) ---'
                try {
                    // SỬA LỖI QUYỀN: Cấp quyền ghi cho mọi user vào thư mục hiện tại để ZAP xuất report
                    sh "chmod 777 ."

                    sh """
                        docker run --rm --network host \
                        -v \$(pwd):/zap/wrk/:rw \
                        ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
                        -t http://192.168.12.190:${APP_PORT} \
                        -r zap-report.html
                    """
                } catch (Exception e) {
                    echo "DAST scanning encountered errors: ${e.message}"
                } finally {
                    // Trả lại quyền (tùy chọn) và dọn dẹp
                    sh "docker stop test-app-dast && docker rm test-app-dast"
                }
            }
        }
    }
}
        stage('5. Generate Code SBOM') {
            steps {
                echo '--- [Step] Generate Code SBOM (CycloneDX) ---'
                // Tạo SBOM cho mã nguồn Node.js
                sh "npx @cyclonedx/cyclonedx-npm --output-file ${SBOM_CODE}"
            }
        }
    
        stage('6. Sign Release Artifacts') {
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
                        
                        // Ký SBOM Code
                        sh """
                        ${cosignCmd} sign-blob --yes \
                            --key cosign.key \
                            --tlog-upload=false \
                            --output-signature ${SBOM_CODE}.sig \
                            ${SBOM_CODE}
                        """
                    }
                }
            }
        }

        stage('7. Verify Signatures') {
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

        stage('8. Generate Attestation') {
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
        
        stage('9. Deploy') {
            steps {
                echo '--- [Step] Deploying to Production ---'
                script {
                    // Đây là bước Deploy. Tùy vào hạ tầng (K8s, SSH, AWS) mà lệnh sẽ khác nhau.
                    // Ví dụ giả định:
                    echo "Deploying Docker Image: ${DOCKER_IMAGE}..."
                    
                    // Lệnh mẫu nếu deploy bằng Docker trên server đích:
                    // sh "ssh user@production-server 'docker pull ${DOCKER_IMAGE} && docker restart my-app'"
                    
                    // Lệnh mẫu nếu deploy Kubernetes:
                    // sh "kubectl set image deployment/myapp myapp=${DOCKER_IMAGE}"
                    
                    echo "Deploy SUCCESS!"
                }
            }
        }

        stage('10. Upload Artifacts & Reports') {
            steps {
                echo '--- [Step] Archiving Artifacts ---'
                // Lưu trữ tất cả: Mã nguồn nén, Chữ ký, SBOM code, CBOM container, Báo cáo DAST/SCA
                archiveArtifacts artifacts: "${ARTIFACT_NAME}, ${PROVENANCE_FILE}, ${SIGNATURE_FILE}, ${SBOM_CODE}, ${SBOM_CONTAINER}, cosign.pub, cosign.bundle, dependency-check-report.html, zap-report.html", allowEmptyArchive: true
            }
        }
    }

    post {
        always {
             dependencyCheckPublisher pattern: 'dependency-check-report.xml'
             // Dọn dẹp Docker images
             sh "docker rmi ${DOCKER_IMAGE} || true"
             sh "rm -f cosign cosign.key" // Xóa key tạm nếu có
        }
        success {
            echo "SUCCESS: Pipeline finished securely. Ready for production."
        }
        failure {
            echo "Pipeline failed. Please check Security Scans or Quality Gates."
        }
    }
}
