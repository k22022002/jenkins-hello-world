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

                        // 2. Cấu hình biến môi trường
                        env.SEEKER_SERVER_URL = "http://192.168.12.190:8082"
                        env.SEEKER_PROJECT_KEY = "jenkins-hello-world"
                        
                        // --- SỬA LỖI TẠI ĐÂY ---
                        // A. Dùng đường dẫn tuyệt đối (${env.WORKSPACE}) thay vì tương đối (.)
                        def agentPath = "${env.WORKSPACE}/seeker/node_modules/@seeker/agent/index.mjs"
                        
                        // B. KHÔNG set env.NODE_OPTIONS toàn cục. 
                        // env.NODE_OPTIONS = ...  <-- Xóa dòng cũ này đi để tránh ảnh hưởng npm test

                        echo "--- Starting App with Seeker Agent Instrument ---"
                        
                        // 3. Khởi chạy ứng dụng (Chỉ gắn NODE_OPTIONS cho lệnh này)
                        // Chúng ta truyền biến môi trường trực tiếp vào dòng lệnh sh
                        sh "NODE_OPTIONS='--import \"${agentPath}\"' nohup npm start > app_iast.log 2>&1 &"
                        
                        // Đợi ứng dụng khởi động
                        sh "sleep 10" 
                        echo "App started via Node.js native process."

                        // 4. Generate Traffic
                        echo "--- Running Integration Tests to trigger IAST ---"
                        try {
                            sh "curl -v http://localhost:${APP_PORT} || true"
                            
                            // Bây giờ 'npm test' sẽ chạy sạch (clean), không bị dính Seeker Agent
                            // nên sẽ không bị lỗi ERR_MODULE_NOT_FOUND
                            sh "npm test" 
                        } catch (Exception e) {
                            echo "Warning: Error during traffic generation, but proceeding..."
                        } finally {
                            // 5. Dọn dẹp
                            sh "pkill -f node || true"
                            echo "Stopped Application."
                        }
                    }
                }
            }
        }
    }
}
