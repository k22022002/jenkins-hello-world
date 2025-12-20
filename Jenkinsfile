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
                        
                        // 1. Reset thư mục seeker để cài mới từ đầu
                        sh "rm -rf seeker app_iast.log || true"

                        // 2. Tải Seeker Agent
                        echo "--- Downloading Seeker Agent ---"
                        sh """
                            sh -c "\$(curl -k -X GET -fsSL --header 'Accept: application/x-sh' \
                            'http://192.168.12.190:8082/rest/api/latest/installers/agents/scripts/NODEJS?osFamily=LINUX&downloadWith=curl&projectKey=jenkins-hello-world&webServer=NODEJS_DOWNLOAD&flavor=DEFAULT&agentName=&accessToken=${SEEKER_ACCESS_TOKEN}')"
                        """

                        // 3. Cài đặt dependencies (Bắt buộc)
                        echo "--- Installing Agent Dependencies ---"
                        dir('seeker') {
                            // Cố gắng cài đặt, bỏ qua lỗi bảo mật
                            sh "npm install --no-audit --no-fund"
                        }

                        // 4. [QUAN TRỌNG] Tự động tìm đường dẫn file Agent
                        // Chúng ta tìm file có tên 'index.mjs' hoặc 'index.js' trong thư mục seeker
                        echo "--- Locating Agent File ---"
                        
                        // In ra cấu trúc thư mục để debug (nếu lỗi tiếp sẽ biết file nằm đâu)
                        sh "ls -R seeker" 

                        // Dùng lệnh find để lấy đường dẫn thực tế
                        def foundPath = sh(script: "find ${env.WORKSPACE}/seeker -type f -name 'index.mjs' | head -n 1", returnStdout: true).trim()
                        
                        // Nếu không thấy .mjs, tìm thử .js
                        if (foundPath == "") {
                             echo "Warning: index.mjs not found. Searching for index.js..."
                             foundPath = sh(script: "find ${env.WORKSPACE}/seeker -type f -name 'index.js' | grep '@seeker/agent' | head -n 1", returnStdout: true).trim()
                        }

                        if (foundPath == "") {
                            error "LỖI: Không tìm thấy file agent (index.mjs hoặc index.js) trong thư mục seeker! Hãy xem log lệnh 'ls -R' ở trên."
                        }

                        echo ">>> Found Agent at: ${foundPath}"

                        // 5. Cấu hình môi trường
                        env.SEEKER_SERVER_URL = "http://192.168.12.190:8082"
                        env.SEEKER_PROJECT_KEY = "jenkins-hello-world"
                        
                        // 6. Chạy App với đường dẫn vừa tìm được
                        echo "--- Starting App ---"
                        sh "pkill -f node || true"
                        
                        // Sử dụng biến foundPath thay vì đường dẫn cứng
                        sh "NODE_OPTIONS='--import \"${foundPath}\"' nohup npm start > app_iast.log 2>&1 &"
                        
                        sh "sleep 15"

                        // 7. Kiểm tra kết quả
                        echo "================ APP LOGS ================"
                        sh "cat app_iast.log"
                        echo "=========================================="
                        
                        def isRunning = sh(script: "pgrep -f 'node' > /dev/null && echo 'YES' || echo 'NO'", returnStdout: true).trim()

                        if (isRunning == 'YES') {
                            echo ">>> SUCCESS: App is running with Seeker!"
                            try {
                                sh "curl -v http://localhost:${APP_PORT} || true"
                                sh "npm test" 
                            } finally {
                                sh "sleep 5"
                                sh "pkill -f node || true"
                            }
                        } else {
                            error ">>> App crashed. Vui lòng kiểm tra log ở trên."
                        }
                    }
                }
            }
        }
    }
}
