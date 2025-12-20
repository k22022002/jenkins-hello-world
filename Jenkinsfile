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
                
                // Sử dụng Credentials ID 'seeker-access-token' như trong hình bạn cung cấp
                withCredentials([string(credentialsId: 'seeker-access-token', variable: 'SEEKER_ACCESS_TOKEN')]) {
                    script {
                        // 1. Cài đặt Seeker Agent tự động
                        // Lệnh này tải và cài đặt agent vào thư mục hiện tại (thường là ./seeker)
                        echo "--- Installing Seeker Agent ---"
                        sh """
                            sh -c "\$(curl -k -X GET -fsSL --header 'Accept: application/x-sh' \
                            'http://192.168.12.190:8082/rest/api/latest/installers/agents/scripts/NODEJS?osFamily=LINUX&downloadWith=curl&projectKey=jenkins-hello-world&webServer=NODEJS_DOWNLOAD&flavor=DEFAULT&agentName=&accessToken=${SEEKER_ACCESS_TOKEN}')"
                        """

                        // 2. Cấu hình biến môi trường (Dựa trên hướng dẫn trong ảnh)
                        env.SEEKER_SERVER_URL = "http://192.168.12.190:8082"
                        env.SEEKER_PROJECT_KEY = "jenkins-hello-world"
                        
                        // Định cấu hình Node để load Agent khi khởi chạy
                        // Đường dẫn này trỏ đến nơi script cài đặt agent (mặc định là ./seeker)
                        env.NODE_OPTIONS = '--import "./seeker/node_modules/@seeker/agent/index.mjs"'
                    }

                    script {
                        echo "--- Starting App with Seeker Agent Instrument ---"
                        
                        // 3. Khởi chạy ứng dụng (Background Mode)
                        // 'npm start' sẽ tự động nhận NODE_OPTIONS và gắn Seeker Agent vào
                        sh "nohup npm start > app_iast.log 2>&1 &"
                        
                        // Đợi ứng dụng khởi động (Healthcheck đơn giản)
                        sh "sleep 10" 
                        echo "App started via Node.js native process."

                        // 4. Generate Traffic (QUAN TRỌNG VỚI IAST)
                        // IAST chỉ tìm thấy lỗi khi có request chạy vào ứng dụng.
                        // Tại đây ta tái sử dụng 'npm test' hoặc chạy các lệnh curl để kích hoạt luồng code.
                        echo "--- Running Integration Tests to trigger IAST ---"
                        try {
                            // Gọi request vào localhost để Agent bắt dữ liệu
                            sh "curl -v http://localhost:${APP_PORT} || true"
                            
                            // Nếu bạn có bộ test API/Integration, hãy chạy ở đây:
                            // sh "npm run test:integration"
                            sh "npm test" 
                        } catch (Exception e) {
                            echo "Warning: Error during traffic generation, but proceeding..."
                        } finally {
                            // 5. Dọn dẹp: Tắt ứng dụng sau khi quét xong
                            sh "pkill -f node || true"
                            echo "Stopped Application."
                        }
                    }
                }
            }
        }
    }
}
