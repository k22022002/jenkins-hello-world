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
                echo '--- [Step] Synopsys Seeker IAST Setup ---'
                
                withCredentials([string(credentialsId: 'seeker-access-token', variable: 'SEEKER_ACCESS_TOKEN')]) {
		script {
    // 1. Cài đặt Seeker Agent
    echo "--- Installing Seeker Agent ---"
    sh """
        sh -c "\$(curl -k -X GET -fsSL --header 'Accept: application/x-sh' \
        'http://192.168.12.190:8082/rest/api/latest/installers/agents/scripts/NODEJS?osFamily=LINUX&downloadWith=curl&projectKey=jenkins-hello-world&webServer=NODEJS_DOWNLOAD&flavor=DEFAULT&agentName=&accessToken=${SEEKER_ACCESS_TOKEN}')"
    """

    // Định nghĩa đường dẫn Agent
    def agentPath = "${env.WORKSPACE}/seeker/node_modules/@seeker/agent/index.mjs"
    
    // --- [DEBUG 1] Kiểm tra file agent có thực sự tồn tại không ---
    echo "--- [DEBUG] Checking Agent Path: ${agentPath} ---"
    sh "ls -l ${agentPath} || echo 'FILE NOT FOUND!'"

    env.SEEKER_SERVER_URL = "http://192.168.12.190:8082"
    env.SEEKER_PROJECT_KEY = "jenkins-hello-world"

    echo "--- Starting App with Seeker Agent ---"
    
    // Xóa log cũ nếu có
    sh "rm -f app_iast.log"

    // Chạy ứng dụng và ghi log
    // Lưu ý: NODE_OPTIONS cần đường dẫn tuyệt đối chính xác
    sh "NODE_OPTIONS='--import \"${agentPath}\"' nohup npm start > app_iast.log 2>&1 &"
    
    echo "--- Waiting for App to startup (10s) ---"
    sh "sleep 10"

    // --- [DEBUG 2] QUAN TRỌNG: In log lỗi ra màn hình ---
    echo "================ APP LOGS (START) ================"
    sh "cat app_iast.log"
    echo "================ APP LOGS (END) ================"

    // Kiểm tra xem process node có đang chạy không
    def isRunning = sh(script: "pgrep -f 'node' > /dev/null && echo 'YES' || echo 'NO'", returnStdout: true).trim()
    
    if (isRunning == 'YES') {
        echo ">>> App is running! Sending Traffic..."
        try {
            sh "curl -v http://localhost:${APP_PORT} || true"
            sh "npm test"
        } finally {
            sh "sleep 5"
            sh "pkill -f node || true"
        }
    } else {
        error ">>> LỖI: Ứng dụng đã bị crash ngay khi khởi động. Hãy xem log ở trên (giữa 2 dòng APP LOGS) để biết nguyên nhân."
    }
}
                }
            }
        }
    }
}
