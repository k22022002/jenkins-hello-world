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
                echo '--- [Test] Running IAST (Manual Mode Fixed) ---'
                withCredentials([string(credentialsId: 'seeker-access-token', variable: 'SEEKER_TOKEN')]) {
                    script {
                        def seekerUrl = "http://192.168.12.190:8082"
                        def projectKey = "jenkins-hello-world"
                        
                        try {
                            echo "--- 1. Download Installation Package ---"
                            // [ĐÃ SỬA LẦN 2]: Xóa hẳn tham số flavor khỏi URL
                            sh '''
                                echo "Đang tải với Project Key: jenkins-hello-world"
                                
                                # LƯU Ý QUAN TRỌNG: 
                                # Đã xóa "?flavor=NPM" hoặc "?flavor=TGZ". 
                                # Để URL đơn giản nhất để Server tự quyết định file trả về.
                                
                                curl -k -o seeker-agent.tgz "http://192.168.12.190:8082/rest/api/latest/installers/agents/binaries/NODEJS?projectKey=jenkins-hello-world&accessToken=$SEEKER_TOKEN"
                                
                                # Kiểm tra file tải về
                                echo "--- KIỂM TRA FILE TẢI VỀ ---"
                                file seeker-agent.tgz
                                
                                # Nếu file nhỏ hơn 1000 bytes, có thể là lỗi JSON
                                FILE_SIZE=$(du -b seeker-agent.tgz | cut -f1)
                                if [ "$FILE_SIZE" -lt 1000 ]; then
                                    echo "!!! LỖI TỪ SERVER SEEKER !!!"
                                    echo "Nội dung phản hồi:"
                                    cat seeker-agent.tgz
                                    echo "--------------------------"
                                    exit 1
                                else
                                    echo ">>> Tải thành công! (Size: $FILE_SIZE bytes)"
                                fi
                            '''
                            
                            echo "--- 2. Install Agent using NPM ---"
                            sh 'npm config set strict-ssl false'
                            // Lệnh này sẽ bung file tgz ra và cài vào node_modules
                            sh 'npm install --no-save ./seeker-agent.tgz'
                            
                            echo "--- 3. Start App with Seeker ---"
                            sh """
                                export SEEKER_SERVER_URL="${seekerUrl}"
                                export SEEKER_PROJECT_KEY="${projectKey}"
                                export SEEKER_ACCESS_TOKEN="${env.SEEKER_TOKEN}"
                                export SEEKER_AGENT_NAME="Jenkins-IAST-${env.BUILD_NUMBER}"
                                
                                # Logic tìm file index.mjs hoặc index.js của agent
                                AGENT_PATH=""
                                if [ -f "node_modules/@seeker/agent/index.mjs" ]; then
                                    AGENT_PATH="node_modules/@seeker/agent/index.mjs"
                                elif [ -f "node_modules/seeker-agent/index.js" ]; then
                                    AGENT_PATH="node_modules/seeker-agent/index.js"
                                else
                                    # Fallback tìm kiếm
                                    AGENT_PATH=\$(find node_modules -name "index.mjs" | grep seeker | head -n 1)
                                fi

                                if [ -z "\$AGENT_PATH" ]; then
                                    echo "ERROR: Không tìm thấy Seeker Agent trong node_modules"
                                    exit 1
                                fi
                                
                                echo ">>> Starting Node with Agent at: \$AGENT_PATH"
                                nohup node --import ./\$AGENT_PATH app.js > app_iast.log 2>&1 &
                                echo \$! > iast_app.pid
                            """

                            // Healthcheck & Traffic (Giữ nguyên)
                            sh """
                                timeout=60
                                while ! curl -s http://localhost:${APP_PORT} > /dev/null; do
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
                            
                            echo "--- Generating Traffic ---"
                            sh 'npm test || true'
                            sh "curl -s http://localhost:${APP_PORT}/"

                        } catch (Exception e) {
                            echo "IAST Error: ${e.toString()}"
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
