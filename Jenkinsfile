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

                        // 2. Tải Seeker Agent
                        echo "--- Downloading Seeker Agent ---"
                        sh """
                            sh -c "\$(curl -k -X GET -fsSL --header 'Accept: application/x-sh' \
                            'http://192.168.12.190:8082/rest/api/latest/installers/agents/scripts/NODEJS?osFamily=LINUX&downloadWith=curl&projectKey=jenkins-hello-world&webServer=NODEJS_DOWNLOAD&flavor=DEFAULT&agentName=&accessToken=${SEEKER_ACCESS_TOKEN}')"
                        """

                        // 3. [FIX] Giải nén (Và KHÔNG chạy npm install)
                        echo "--- Extracting Agent ---"
                        dir('seeker') {
                            // Giải nén file tgz
                            sh "tar -xzf seeker-agent.tgz"
                            
                            // Mặc định nó bung ra thư mục tên là 'package', đổi tên lại cho đẹp
                            sh "mv package agent-core"
                            
                            // [QUAN TRỌNG] Kiểm tra xem trong này đã có thư mục node_modules sẵn chưa?
                            // Hầu hết các bản Enterprise Agent đều đóng gói sẵn.
                            sh "ls -F agent-core/"
                        }

                        // 4. Xác định đường dẫn file chạy
                        def agentDir = "${env.WORKSPACE}/seeker/agent-core"
                        def agentFile = ""
                        
                        // Ưu tiên tìm index.mjs, sau đó đến index.js, sau đó đến src/index.js
                        if (fileExists("${agentDir}/index.mjs")) {
                            agentFile = "${agentDir}/index.mjs"
                        } else if (fileExists("${agentDir}/index.js")) {
                            agentFile = "${agentDir}/index.js"
                        } else {
                            // Trường hợp xấu nhất: File nằm sâu hơn hoặc tên khác
                            echo "--- Warning: Standard index file not found. Searching... ---"
                            agentFile = sh(script: "find ${agentDir} -name index.mjs -o -name index.js | head -n 1", returnStdout: true).trim()
                        }

                        if (agentFile == "") {
                            sh "ls -R seeker"
                            error "LỖI: Không tìm thấy file chạy của Agent sau khi giải nén."
                        }

                        echo ">>> FOUND AGENT AT: ${agentFile}"

                        // 5. Cấu hình môi trường
                        env.SEEKER_SERVER_URL = "http://192.168.12.190:8082"
                        env.SEEKER_PROJECT_KEY = "jenkins-hello-world"
                        
                        // 6. Chạy App
                        echo "--- Starting App ---"
                        sh "pkill -f node || true"
                        
                        // Chạy App với đường dẫn tuyệt đối tới file agent vừa giải nén
                        sh "NODE_OPTIONS='--import \"${agentFile}\"' nohup npm start > app_iast.log 2>&1 &"
                        
                        sh "sleep 15" // Đợi App khởi động

                        // 7. Kiểm tra kết quả
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
                            error ">>> App crashed. Kiểm tra log ở trên. Nếu lỗi là 'Cannot find module', có thể file nén bị lỗi."
                        }
                    }
                }
            }
        }
    }
}
