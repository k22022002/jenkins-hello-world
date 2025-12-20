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

        // --- BƯỚC 2: CHẠY IAST (SEEKER) ---
	stage('2. IAST (Seeker)') {
            steps {
                echo '--- [Test] Running IAST Only (Fixed from Image) ---'
                withCredentials([string(credentialsId: 'seeker-access-token', variable: 'SEEKER_TOKEN')]) {
                    script {
                        def seekerUrl = "http://192.168.12.190:8082"
                        def projectKey = "jenkins_hello_world"
                        
                        try {
                            echo "--- 1. Downloading Seeker Agent ---"
                            // Tải file .tgz trực tiếp từ API của Server bạn
                            // API này tương đương với việc bạn bấm nút "Download" trong ảnh
                            sh """
                                curl -f -k -o seeker-agent.tgz "${seekerUrl}/rest/api/latest/installers/agents/binaries/NODEJS?flavor=TGZ"
                            """

                            echo "--- 2. Installing Agent ---"
                            sh 'npm config set strict-ssl false'
                            // Cài đặt file vừa tải về
                            sh 'npm install --no-save ./seeker-agent.tgz'

                            echo "--- 3. Verifying Installation Path ---"
                            // [QUAN TRỌNG] Tìm xem file index.mjs nằm chính xác ở đâu
                            // Vì ảnh gợi ý tên gói là @seeker/agent, ta cần tìm đúng đường dẫn
                            sh 'find node_modules -name "index.mjs" | grep seeker'

                            echo "--- 4. Starting App with Seeker Agent ---"
                            sh """
                                export SEEKER_SERVER_URL="${seekerUrl}"
                                export SEEKER_ACCESS_TOKEN="${env.SEEKER_TOKEN}"
                                export SEEKER_PROJECT_KEY="${projectKey}"
                                export SEEKER_AGENT_NAME="Jenkins-IAST-${env.BUILD_NUMBER}"
                                
                                # [CẬP NHẬT THEO ẢNH]
                                # Sử dụng --import thay vì -r
                                # Trỏ vào file index.mjs trong thư mục vừa cài đặt
                                # Đường dẫn chuẩn thường là: ./node_modules/@seeker/agent/index.mjs
                                
                                nohup node --import ./node_modules/@seeker/agent/index.mjs app.js > app_iast.log 2>&1 &
                                echo \$! > iast_app.pid
                            """

                            // Healthcheck (Giữ nguyên)
                            sh """
                                timeout=60
                                while ! curl -s http://localhost:${APP_PORT} > /dev/null; do
                                    echo "Waiting for App..."
                                    sleep 2
                                    timeout=\$((timeout-2))
                                    if [ \$timeout -le 0 ]; then 
                                        echo "TIMEOUT! Checking logs..."
                                        cat app_iast.log
                                        exit 1
                                    fi
                                done
                                echo "App is READY!"
                            """

                            // Generate Traffic (Giữ nguyên)
                            echo "--- Generating Traffic ---"
                            sh 'npm test || true' 
                            sh "curl -s http://localhost:${APP_PORT}/"
                            echo "IAST Scan Success."

                        } catch (Exception e) {
                            echo "IAST Error: ${e.toString()}"
                            // Nếu lỗi, in log ra để xem đường dẫn file sai ở đâu
                            sh 'cat app_iast.log || true'
                            currentBuild.result = 'FAILURE'
                        } finally {
                            if (fileExists('iast_app.pid')) {
                                sh "kill \$(cat iast_app.pid) || true"
                            }
                            sh 'rm -f seeker-agent.tgz'
                        }
                    }
                }
            }
        }
    }
}
