pipeline {
    agent any 

    tools {
        nodejs 'NodeJS'
    }

    environment {
        APP_PORT = "3000"
    }

    stages {
        // --- BƯỚC 1: SETUP (Thông minh) ---
        stage('1. Smart Setup') {
            steps {
                script {
                    echo '--- [Setup] Checking existing workspace ---'
                    
                    // 1. QUAN TRỌNG: Tuyệt đối KHÔNG dùng lệnh cleanWs() ở đây
                    // cleanWs() -> Nếu dùng lệnh này, mọi công sức cũ sẽ mất hết!

                    // 2. Kiểm tra Source Code
                    if (!fileExists('package.json')) {
                        echo 'Code not found. Checking out...'
                        checkout scm
                    } else {
                        echo '>>> Source code found. Skipping checkout.'
                    }

                    // 3. Kiểm tra Thư viện (node_modules)
                    if (!fileExists('node_modules')) {
                        echo 'Dependencies not found. Installing...'
                        sh 'npm ci'
                    } else {
                        echo '>>> node_modules found. Skipping npm install.'
                    }
                }
            }
        }
	stage('4. IAST (Synopsys Seeker)') {
            steps {
                script {
                    echo '--- [Step] Synopsys Seeker IAST Setup ---'
                    withCredentials([string(credentialsId: 'seeker-access-token', variable: 'SEEKER_ACCESS_TOKEN')]) {
                        
                        // 1. Reset thư mục
                        sh "rm -rf seeker app_iast.log || true"

                        // 2. Tải file về (Giữ nguyên)
                        echo "--- Downloading Seeker Agent ---"
                        sh """
                            sh -c "\$(curl -k -X GET -fsSL --header 'Accept: application/x-sh' \
                            'http://192.168.12.190:8082/rest/api/latest/installers/agents/scripts/NODEJS?osFamily=LINUX&downloadWith=curl&projectKey=jenkins-hello-world&webServer=NODEJS_DOWNLOAD&flavor=DEFAULT&agentName=&accessToken=${SEEKER_ACCESS_TOKEN}')"
                        """

                        // 3. [FIX] Giải nén và Cài đặt thủ công
                        echo "--- Manually Extracting & Installing ---"
                        dir('seeker') {
                            // File nén thường có tên seeker-agent.tgz
                            // Khi giải nén npm pack, nó thường bung ra thư mục tên là 'package'
                            sh "tar -xzf seeker-agent.tgz"
                            
                            // Đổi tên thư mục 'package' thành 'agent-core' cho dễ quản lý
                            sh "mv package agent-core"
                            
                            // Vào thư mục vừa giải nén để cài dependencies
                            dir('agent-core') {
                                echo "Installing dependencies inside agent..."
                                sh "npm install --production --no-audit --no-fund"
                            }
                        }

                        // 4. Tìm đường dẫn file chạy (index.mjs hoặc index.js)
                        // Bây giờ file chắc chắn nằm trong seeker/agent-core/
                        def agentDir = "${env.WORKSPACE}/seeker/agent-core"
                        def agentFile = ""
                        
                        // Kiểm tra file tồn tại
                        if (fileExists("${agentDir}/index.mjs")) {
                            agentFile = "${agentDir}/index.mjs"
                        } else if (fileExists("${agentDir}/index.js")) {
                            agentFile = "${agentDir}/index.js"
                        } else {
                            // Debug nếu vẫn không thấy
                            sh "ls -R seeker"
                            error "Vẫn không tìm thấy file index.mjs/index.js sau khi giải nén!"
                        }

                        echo ">>> FOUND AGENT AT: ${agentFile}"

                        // 5. Cấu hình môi trường
                        env.SEEKER_SERVER_URL = "http://192.168.12.190:8082"
                        env.SEEKER_PROJECT_KEY = "jenkins-hello-world"
                        
                        // 6. Chạy App
                        echo "--- Starting App ---"
                        sh "pkill -f node || true" // Kill process cũ
                        
                        // Dùng biến agentFile vừa tìm được
                        sh "NODE_OPTIONS='--import \"${agentFile}\"' nohup npm start > app_iast.log 2>&1 &"
                        
                        sh "sleep 15" // Đợi app khởi động và kết nối Seeker

                        // 7. Kiểm tra log
                        echo "================ APP LOGS ================"
                        sh "cat app_iast.log"
                        echo "=========================================="
                        
                        def isRunning = sh(script: "pgrep -f 'node' > /dev/null && echo 'YES' || echo 'NO'", returnStdout: true).trim()

                        if (isRunning == 'YES') {
                            echo ">>> SUCCESS: App is running with Seeker!"
                            try {
                                echo "--- Sending Traffic ---"
                                sh "curl -v http://localhost:${APP_PORT} || true"
                                sh "npm test" 
                            } finally {
                                sh "sleep 5"
                                sh "pkill -f node || true"
                            }
                        } else {
                            error ">>> App crashed. Kiểm tra log ở trên."
                        }
                    }
                }
            }
        }
    }
}
