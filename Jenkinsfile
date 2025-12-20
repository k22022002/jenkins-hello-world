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
                        
                        // 1. Tải Seeker Agent (Giữ nguyên)
                        // Lệnh này sẽ tạo thư mục './seeker'
                        sh """
                            rm -rf seeker || true
                            sh -c "\$(curl -k -X GET -fsSL --header 'Accept: application/x-sh' \
                            'http://192.168.12.190:8082/rest/api/latest/installers/agents/scripts/NODEJS?osFamily=LINUX&downloadWith=curl&projectKey=jenkins-hello-world&webServer=NODEJS_DOWNLOAD&flavor=DEFAULT&agentName=&accessToken=${SEEKER_ACCESS_TOKEN}')"
                        """

                        // 2. [QUAN TRỌNG] Cài đặt dependencies cho Seeker Agent
                        // Đây là bước đang bị thiếu khiến lỗi module not found xảy ra
                        echo "--- Fixing Seeker Dependencies ---"
                        dir('seeker') {
                            // Chạy npm install bên trong thư mục seeker để tạo node_modules
                            sh 'npm install --no-audit --no-fund'
                        }

                        // 3. Kiểm tra file tồn tại chưa (Debug)
                        // Lệnh này sẽ tìm file index.mjs và in đường dẫn ra để ta chắc chắn
                        echo "--- Verifying Agent File ---"
                        sh "find ${env.WORKSPACE}/seeker -name index.mjs"

                        // 4. Cấu hình đường dẫn tuyệt đối
                        // Lưu ý: Sau khi npm install, đường dẫn chuẩn thường là như bên dưới
                        def agentPath = "${env.WORKSPACE}/seeker/node_modules/@seeker/agent/index.mjs"
                        
                        env.SEEKER_SERVER_URL = "http://192.168.12.190:8082"
                        env.SEEKER_PROJECT_KEY = "jenkins-hello-world"

                        echo "--- Starting App with Seeker Agent ---"
                        
                        // Dọn dẹp process cũ
                        sh "pkill -f node || true"
                        sh "rm -f app_iast.log"

                        // 5. Chạy App
                        sh "NODE_OPTIONS='--import \"${agentPath}\"' nohup npm start > app_iast.log 2>&1 &"
                        
                        sh "sleep 15" // Đợi app khởi động

                        // 6. Kiểm tra Log và Process
                        echo "================ APP LOGS ================"
                        sh "cat app_iast.log"
                        echo "=========================================="
                        
                        // Kiểm tra xem node có đang chạy không
                        def isRunning = sh(script: "pgrep -f 'node' > /dev/null && echo 'YES' || echo 'NO'", returnStdout: true).trim()

                        if (isRunning == 'YES') {
                            echo ">>> App is running successfully with Seeker!"
                            try {
                                echo "--- Sending Traffic ---"
                                sh "curl -v http://localhost:${APP_PORT} || true"
                                sh "npm test" 
                            } finally {
                                sh "sleep 5"
                                sh "pkill -f node || true"
                            }
                        } else {
                            error ">>> App crashed. Kiểm tra log ở trên. Nếu lỗi vẫn là MODULE_NOT_FOUND, hãy xem kết quả lệnh 'find' in ra gì."
                        }
                    }
                }
            }
        }
    }
}
