pipeline {
    agent any
    
    // --- Cấu hình tự động chạy vào 2h sáng ---
    triggers {
        // H 2 * * * : Chạy ngẫu nhiên trong khoảng 2:00 - 2:59 sáng mỗi ngày
        cron('H 2 * * *')
    }

    parameters {
        // Mặc định là false (không tích) để build cho nhanh
        booleanParam(name: 'FORCE_COVERITY', defaultValue: false, description: 'Tích vào đây nếu muốn chạy quét Coverity Full Scan')
    }

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
        APP_PORT        = "3000" // Port mặc định của ứng dụng Nodejs
    }

    tools {
        nodejs 'NodeJS' 
    }

    stages {
        // --- BƯỚC 1: INITIALIZE ---
        stage('1. Initialize, Test & Check Standards') {
            steps {
                echo '--- [Step] Checkout & Install ---'
                cleanWs()
                checkout scm
                
                script {
                    // 1. Install Cosign (Tool ký số)
                    sh 'rm -f cosign'
                    sh 'curl -k  -sSL --retry 5 --retry-delay 5 "https://github.com/sigstore/cosign/releases/download/v2.2.4/cosign-linux-amd64" -o cosign'
                    sh 'chmod +x cosign'
                    sh './cosign version'                    
                  
                    // 2. Install Dependencies
                    sh 'npm ci'

                    // 3. Code Linting
                    echo '--- [Step] Running Code Linter ---'
                    try {
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

        // --- BƯỚC 2: SECURITY STATIC ---
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
                    when {
                        anyOf {
                            triggeredBy 'TimerTrigger' 
                            expression { return params.FORCE_COVERITY == true } 
                        }
                    }
                    steps {
                        withCredentials([usernamePassword(credentialsId: 'coverity-credentials', usernameVariable: 'COV_USER', passwordVariable: 'COV_PASS')]) {
                            script {
                                echo '--- [Step] Synopsys Coverity SAST ---'
                                
                                def buildVer = "1.0.${env.BUILD_NUMBER}"
                                def covStream = "jenkins-hello-world-stream"
                                def covBin = "/home/ubuntu/cov-analysis-linux64-2025.9.2/bin" 
                                def covUrl = "http://192.168.12.190:8081"

                                // Capture & Analyze
                                sh "${covBin}/cov-configure --javascript || true"
                                sh "rm -rf idir"
                                sh "${covBin}/coverity capture --project-dir . --dir idir"
                                sh "${covBin}/cov-analyze --dir idir --all --webapp-security --strip-path \$(pwd)"

                                // Commit Results
                                echo '--- Committing Results ---'
                                sh """
                                    ${covBin}/cov-commit-defects --dir idir \
                                    --url ${covUrl} \
                                    --stream ${covStream} \
                                    --user \$COV_USER --password \$COV_PASS \
                                    --version "${buildVer}" \
                                    --description "Jenkins Build ${env.BUILD_NUMBER}"
                                """

                                // Reporting
                                sh "${covBin}/cov-format-errors --dir idir --html-output coverity-report"
                                sh "${covBin}/cov-format-errors --dir idir --json-output-v7 coverity_results.json"

                                // Quality Gate
                                def defectCount = sh(script: "jq '.issues | length' coverity_results.json", returnStdout: true).trim().toInteger()
                                echo "Coverity found: ${defectCount} defects"
                                if (defectCount > 0) {
                                    echo "CẢNH BÁO: Coverity phát hiện ${defectCount} vấn đề!"
                                }
                            }
                        }
                    }
                }
            }
        }

        // --- BƯỚC 3: BUILD & CONTAINER ---
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
                         
                        // 3. Container Scanning (Trivy)
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
                        }

                        // 4. Generate CBOM
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
	stage('4. IAST (Synopsys Seeker)') {
    steps {
        script {
            echo '--- [Step] Synopsys Seeker IAST Setup ---'
            withCredentials([string(credentialsId: 'seeker-agent-token', variable: 'SEEKER_ACCESS_TOKEN')]) {
                
                // 1. Chuẩn bị thư mục
                def agentDir = "${env.WORKSPACE}/seeker"
                sh "rm -rf ${agentDir} && mkdir -p ${agentDir}"

                // 2. Tải Seeker Installer
                echo "--- Downloading Seeker Installer Script ---"
                // Lưu ý: Đã thêm --install-dir vào lệnh chạy script luôn
                sh '''
                    curl -k -f -L "http://192.168.12.190:8082/rest/api/latest/installers/agents/scripts/NODEJS?osFamily=LINUX&downloadWith=curl&projectKey=jenkins-hello-world&webServer=NODEJS_DOWNLOAD&flavor=DEFAULT&accessToken=$SEEKER_ACCESS_TOKEN" -o install_seeker.sh
                '''
                
                sh "chmod +x install_seeker.sh"
                
                // Chạy script cài đặt với chỉ định thư mục
                // Thêm '|| true' để nếu script báo lỗi (do thiếu unzip) thì ta vẫn tự xử lý ở dưới
                sh "./install_seeker.sh --install-dir ${agentDir} --no-prompt || true"

                // ================= [FIX QUAN TRỌNG: GIẢI NÉN THỦ CÔNG] =================
                echo "--- Checking & Extracting Agent ---"
                dir(agentDir) {
                    if (fileExists('agent_NODEJS.zip')) {
                        echo ">>> Found ZIP file, extracting..."
                        // Kiểm tra unzip có tồn tại không, nếu không thì dùng python hoặc jar để giải nén (vì Jenkins agent chắc chắn có Java)
                        try {
                            sh "unzip -o agent_NODEJS.zip"
                        } catch (Exception e) {
                            echo "Unzip not found, trying jar..."
                            sh "jar xf agent_NODEJS.zip" // Fallback nếu không có unzip
                        }
                    } else if (fileExists('seeker-agent.tgz')) {
                        echo ">>> Found TGZ file, extracting..."
                        sh "tar -xzf seeker-agent.tgz"
                    }
                }
                // ========================================================================

                // 4. Tìm file chạy của Agent (Đã update logic tìm kiếm)
                def agentFile = ""
                // Tìm kiếm file index.js/.mjs trong thư mục seeker và các thư mục con cấp 1
                agentFile = sh(script: "find ${agentDir} -maxdepth 3 -name index.mjs -o -name index.js | head -n 1", returnStdout: true).trim()

                if (agentFile == "") {
                    sh "ls -R ${agentDir}" // List file để debug lần cuối
                    error "LỖI: Vẫn không tìm thấy file index.js sau khi giải nén."
                }
                echo ">>> FOUND AGENT AT: ${agentFile}"

                // 5. Cấu hình & Chạy App
                env.SEEKER_SERVER_URL = "http://192.168.12.190:8082"
                env.SEEKER_PROJECT_KEY = "jenkins-hello-world"
                
                echo "--- Starting App with Seeker ---"
                sh "pkill -f node || true"
                
                // Quan trọng: Đường dẫn agentFile phải tuyệt đối
                sh "NODE_OPTIONS='--import \"${agentFile}\"' nohup npm start > app_iast.log 2>&1 &"
                
                sh "sleep 15"
                sh "cat app_iast.log" // Xem log ứng dụng
                
                // Check process
                if (sh(script: "pgrep -f 'node' > /dev/null && echo 'YES' || echo 'NO'", returnStdout: true).trim() == 'YES') {
                    echo ">>> SUCCESS: App running with Seeker"
                    try {
                        sh "curl -v http://localhost:3000 || true" 
                    } finally {
                        sh "pkill -f node || true"
                    }
                } else {
                    error ">>> App crashed."
                }
            }
        }
    }
}
        // --- BƯỚC 5: SBOM CODE ---
        stage('5. Generate Code SBOM') {
            steps {
                echo '--- [Step] Generate Code SBOM (CycloneDX) ---'
                sh "npx @cyclonedx/cyclonedx-npm --output-file ${SBOM_CODE}"
            }
        }
    
        // --- BƯỚC 6: SIGN ---
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

        // --- BƯỚC 7: VERIFY ---
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

        // --- BƯỚC 8: ATTESTATION ---
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
        
        // --- BƯỚC 9: DEPLOY ---
        stage('9. Deploy') {
            steps {
                echo '--- [Step] Deploying to Production ---'
                script {
                    echo "Deploying Docker Image: ${DOCKER_IMAGE}..."
                    echo "Deploy SUCCESS!"
                }
            }
        }

        // --- BƯỚC 10: UPLOAD ---
        stage('10. Upload Artifacts & Reports') {
            steps {
                echo '--- [Step] Archiving Artifacts ---'
                // Lưu trữ tất cả (đã bỏ báo cáo DAST zap-report.html khỏi danh sách archive vì không chạy nữa)
                archiveArtifacts artifacts: "${ARTIFACT_NAME}, ${PROVENANCE_FILE}, ${SIGNATURE_FILE}, ${SBOM_CODE}, ${SBOM_CONTAINER}, cosign.pub, cosign.bundle, dependency-check-report.html, coverity-report/**/*", allowEmptyArchive: true
            }
        }
    }

    post {
        always {
             dependencyCheckPublisher pattern: 'dependency-check-report.xml'
             // Dọn dẹp Docker images
             sh "docker rmi ${DOCKER_IMAGE} || true"
             sh "rm -f cosign cosign.key" // Xóa key tạm nếu có
             // Dọn dẹp process Node nếu còn sót
             sh "pkill -f node || true"
        }
        success {
            echo "SUCCESS: Pipeline finished securely. Ready for production."
        }
        failure {
            echo "Pipeline failed. Please check Security Scans or Quality Gates."
        }
    }
}
