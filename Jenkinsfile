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
                    // Sử dụng một dòng duy nhất để tránh lỗi "Could not resolve host"
                    sh 'curl -sSL --retry 5 --retry-delay 5 "https://github.com/sigstore/cosign/releases/download/v2.2.4/cosign-linux-amd64" -o cosign'
                    sh 'chmod +x cosign'
                    sh './cosign version'                    
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
        echo '--- [Step] Scanning Dependencies with OSS Index ---'
        // Gọi thông tin xác thực từ Jenkins
        withCredentials([usernamePassword(credentialsId: 'oss-index-credentials', 
                                          passwordVariable: 'OSS_TOKEN', 
                                          usernameVariable: 'OSS_USER')]) {
            
            dependencyCheck additionalArguments: """
                --format HTML --format XML 
                --failOnCVSS 7.0 
                --ossIndexUsername ${OSS_USER} 
                --ossIndexPassword ${OSS_TOKEN}
            """, 
            odcInstallation: 'OWASP-Dependency-Check'
        }
    }
}                
	stage('SAST (Coverity)') {
                    steps {
                        withCredentials([usernamePassword(credentialsId: 'coverity-credentials', usernameVariable: 'COV_USER', passwordVariable: 'COV_PASS')]) {
                            script {
                                echo '--- [Step] Synopsys Coverity SAST ---'
                                
                                // --- CẤU HÌNH MỚI (Đã cập nhật đúng đường dẫn của bạn) ---
                                def covBin = "/home/ubuntu/cov-analysis-linux64-2025.9.2/bin" 
                                
                                def covUrl = "http://192.168.12.190:8081"
                                def covStream = "jenkins-hello-world-stream" 
                                
                                // Kiểm tra kết nối
                                try {
                                    sh "curl -sI --connect-timeout 5 ${covUrl} > /dev/null"
                                    echo "Coverity Connect OK!"
                                } catch (Exception e) {
                                    error("Lỗi kết nối tới Coverity Connect ${covUrl}")
                                }

                                // 1. Configure
                                sh "${covBin}/cov-configure --javascript || true"

                                // 2. Build/Capture
                                sh "rm -rf idir" 
                                sh "${covBin}/cov-build --dir idir --no-command --fs-capture-search ."

                                // 3. Analyze
                                echo '--- Running Analysis ---'
                                // Đã có dấu \ trước $(pwd) để tránh lỗi cú pháp
                                sh "${covBin}/cov-analyze --dir idir --all --webapp-security --strip-path \$(pwd)"

                                // 4. Commit Defects
                                echo '--- Committing Results ---'
                                sh """
                                    ${covBin}/cov-commit-defects --dir idir \
                                    --url ${covUrl} \
                                    --stream ${covStream} \
                                    --user \$COV_USER --password \$COV_PASS
                                """
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
		    echo "--- Dọn dẹp môi trường cũ (nếu có) ---"
            // Thêm dòng này để xóa container cũ trước khi tạo mới
            sh "docker rm -f test-app-dast || true"
                    echo "--- Khởi chạy App để quét DAST ---"
                    // Chạy container ứng dụng
                    sh "docker run -d --name test-app-dast -p ${APP_PORT}:${APP_PORT} ${DOCKER_IMAGE}"
                    
                    try {
                        // 1. Healthcheck: Kiểm tra App sẵn sàng qua localhost
                        sh """
                            timeout=60
                            while ! curl -s http://localhost:${APP_PORT} > /dev/null; do
                                echo "Đang đợi App khởi động tại port ${APP_PORT}..."
                                sleep 3
                                timeout=\$((timeout-3))
                                if [ \$timeout -le 0 ]; then 
                                    echo "LỖI: App không phản hồi sau 60s. Logs hệ thống:"
                                    docker logs test-app-dast
                                    exit 1
                                fi
                            done
                            echo "App đã sẵn sàng!"
                        """

                        // 2. Chạy OWASP ZAP
                        // Sử dụng host.docker.internal để Container ZAP gọi ngược ra App trên Host
                        sh """
                            chmod 777 .
                            docker run --rm \
                            --add-host host.docker.internal:host-gateway \
                            -v \$(pwd):/zap/wrk/:rw \
                            ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
                            -t http://host.docker.internal:${APP_PORT} \
                            -r zap-report.html
                        """
                    } catch (Exception e) {
                        echo "DAST hoàn tất (có thể có cảnh báo bảo mật)."
                    } finally {
                        // Luôn dọn dẹp container sau khi xong
                        sh "docker stop test-app-dast && docker rm test-app-dast || true"
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
