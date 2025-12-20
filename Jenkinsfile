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
                echo '--- [Test] Running IAST Only ---'
                withCredentials([string(credentialsId: 'seeker-access-token', variable: 'SEEKER_TOKEN')]) {
		script {
                        def seekerUrl = "http://192.168.12.190:8082"
                        def projectKey = "jenkins_hello_world"
                        
                        try {
                            echo "--- 1. Configuring NPM & Installing Agent ---"
                            // Tắt SSL strict để tránh lỗi ngày giờ
                            sh 'npm config set strict-ssl false'
                            sh 'npm config set registry "http://registry.npmjs.org/"'
                            
                            // Cài đặt Agent
                            sh 'npm install --no-save @synopsys/seeker-agent'

                            // [DEBUG] Kiểm tra xem file có thực sự tồn tại không?
                            echo "--- DEBUG: Checking installed modules ---"
                            sh 'ls -la node_modules/@synopsys/seeker-agent || echo "WARNING: Folder not found!"'

                            echo "--- 2. Starting App with Seeker Agent ---"
                            sh """
                                export SEEKER_SERVER_URL="${seekerUrl}"
                                export SEEKER_ACCESS_TOKEN="${env.SEEKER_TOKEN}"
                                export SEEKER_PROJECT_KEY="${projectKey}"
                                export SEEKER_AGENT_NAME="Jenkins-Test-IAST-${env.BUILD_NUMBER}"
                                
                                # [SỬA LỖI Ở ĐÂY]
                                # Thay vì gọi file index.js, ta gọi tên gói để Node tự tìm entrypoint
                                nohup node -r @synopsys/seeker-agent app.js > app_iast.log 2>&1 &
                                echo \$! > iast_app.pid
                            """

                            // 3. Healthcheck
                            sh """
                                timeout=60
                                while ! curl -s http://localhost:${APP_PORT} > /dev/null; do
                                    echo "Waiting for App..."
                                    sleep 2
                                    timeout=\$((timeout-2))
                                    if [ \$timeout -le 0 ]; then 
                                        echo "TIMEOUT: App failed to start."
                                        echo "--- LOG APP ---"
                                        cat app_iast.log
                                        exit 1
                                    fi
                                done
                                echo "App is READY!"
                            """

                            // 4. Generate Traffic
                            echo "--- Generating Traffic ---"
                            sh 'npm test || true' 
                            sh "curl -s http://localhost:${APP_PORT}/"
                            echo "IAST Scan Success."

                        } catch (Exception e) {
                            echo "IAST Error: ${e.toString()}"
                            currentBuild.result = 'FAILURE'
                        } finally {
                            if (fileExists('iast_app.pid')) {
                                sh "kill \$(cat iast_app.pid) || true"
                            }
                        }
                    }
                }
            }
        }
    }
}
