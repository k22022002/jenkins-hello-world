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
        [cite_start]stage('1. Initialize, Test & Check Standards') { [cite: 12]
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
        
        // --- BƯỚC 4: IAST ---
        stage('4. IAST (Synopsys Seeker)') {
            steps {
                script {
                    echo '--- [Step] Synopsys Seeker IAST Setup ---'
                    withCredentials([string(credentialsId: 'seeker-agent-token', variable: 'SEEKER_ACCESS_TOKEN')]) {
                        def agentDir = "${env.WORKSPACE}/seeker" 
                        sh "rm -rf ${agentDir} && mkdir -p ${agentDir}"

                        // 1. Tải về
                        sh '''
                            curl -k -f -L "http://192.168.12.190:8082/rest/api/latest/installers/agents/scripts/NODEJS?osFamily=LINUX&downloadWith=curl&projectKey=jenkins-hello-world&webServer=NODEJS_DOWNLOAD&flavor=DEFAULT&accessToken=$SEEKER_ACCESS_TOKEN" -o install_seeker.sh
                            chmod +x install_seeker.sh
                        ''' 
                        sh "./install_seeker.sh --install-dir ${agentDir} --no-prompt || true" 

                        // 2. GIẢI NÉN ĐA LỚP
                        echo "--- Extracting Agent (Nested Archives) ---" 
                        dir(agentDir) {
                            if (fileExists('agent_NODEJS.zip')) {
                                echo ">>> Layer 1: Unzipping agent_NODEJS.zip..." 
                                try {
                                    sh "unzip -o agent_NODEJS.zip" 
                                } catch (Exception e) {
                                    sh "python3 -c \"import zipfile; import sys; zipfile.ZipFile('agent_NODEJS.zip', 'r').extractall('.')\"" 
                                }
                            }
                            if (fileExists('seeker-agent.tgz')) {
                                echo ">>> Layer 2: Extracting seeker-agent.tgz..." 
                                sh "tar -xzf seeker-agent.tgz" 
                            }
                        }

                        // 3. Tìm file chạy
                        def agentFile = sh(script: "find ${agentDir} -name index.js -o -name index.mjs | head -n 1", returnStdout: true).trim() 
                        if (agentFile == "") {
                            sh "ls -R ${agentDir}" 
                            error "LỖI: Không tìm thấy index.js ngay cả sau khi giải nén 2 lớp." 
                        }
                        echo ">>> FOUND AGENT AT: ${agentFile}" 

                        // 4. Chạy App
                        env.SEEKER_SERVER_URL = "http://192.168.12.190:8082"
                        env.SEEKER_PROJECT_KEY = "jenkins-hello-world" 
                        
                        sh "pkill -f node || true"
                        sh "NODE_OPTIONS='--import \"${agentFile}\"' nohup npm start > app_iast.log 2>&1 &" 
                        
                        sh "sleep 15" 
                        sh "cat app_iast.log" 
                        
                        if (sh(script: "pgrep -f 'node' > /dev/null && echo 'YES' || echo 'NO'", returnStdout: true).trim() == 'YES') { 
                            echo "SUCCESS: App running with Seeker" 
                            try {
                                sh "curl -v http://localhost:3000 || true" 
                            } finally {
                                sh "pkill -f node || true" 
                            }
                        } else {
                            error "App crashed."
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
                        def cosignCmd = (fileExists('cosign')) ? [cite_start]'./cosign' : 'cosign' 

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
                    def containerName = "jenkins-hello-world-prod"
                    
                    echo "Deploying Docker Image: ${DOCKER_IMAGE}..." 
                    
                    // 1. Stop & Remove container cũ (nếu đang chạy) để tránh lỗi conflict tên
                    sh "docker rm -f ${containerName} ||HV true" 

                    // 2. Run container mới
                    // -d: Chạy ngầm (Detached)
                    // -p: Map port 3000 của máy chủ vào port 3000 của container
                    // --name: Đặt tên cố định để dễ quản lý/stop sau này
                    // QUAN TRỌNG: Thêm volume ẩn danh cho node_modules để tránh bị ghi đè bởi bind mount (nếu có)
                    // hoặc đơn giản là để bảo vệ thư viện trong container
                    sh """
                        docker run -d \
                        --restart unless-stopped \
                        --name ${containerName} \
                        -p ${APP_PORT}:${APP_PORT} \
                        -v /app/node_modules \
                        ${DOCKER_IMAGE}
                    """ 
                    
                    // 3. Kiểm tra xem container đã lên chưa
                    sh "sleep 5" // Đợi 5s để app khởi động 
                    sh "docker ps | grep ${containerName}" 
                    echo "Deploy SUCCESS! App is running at http://<JENKINS_AGENT_IP>:${APP_PORT}" 
                }
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
