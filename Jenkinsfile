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
                echo '--- [Test] Running IAST (Debug Mode) ---'
                withCredentials([string(credentialsId: 'seeker-access-token', variable: 'SEEKER_TOKEN')]) {
                    script {
                        def seekerUrl = "http://192.168.12.190:8082"
                        def projectKey = "jenkins-hello-world"
                        
                        try {
                            echo "--- 1. Download Agent (Header Auth Method) ---"
                            
                            // SỬ DỤNG SINGLE QUOTES (''') ĐỂ TRÁNH LỖI BẢO MẬT JENKINS
                            sh '''
                                echo "Downloading from Seeker Server..."
                                rm -f seeker-agent.tgz
                                
                                # CÁCH MỚI:
                                # 1. Dùng Header "Authorization: Bearer" thay vì ?accessToken trên URL
                                # 2. URL chỉ giữ lại projectKey (và flavor NPM nếu cần thiết, thử không flavor trước)
                                
                                curl -k -v -H "Authorization: Bearer $SEEKER_TOKEN" \
                                     -o seeker-agent.tgz \
                                     "http://192.168.12.190:8082/rest/api/latest/installers/agents/binaries/NODEJS?projectKey=jenkins-hello-world&flavor=NPM"
                                
                                echo "--- KIỂM TRA NỘI DUNG FILE ---"
                                ls -lh seeker-agent.tgz
                                
                                # Kiểm tra xem file tải về là Text (Lỗi) hay Data (Thành công)
                                file seeker-agent.tgz
                                
                                # Đọc 10 dòng đầu tiên (nếu là lỗi JSON nó sẽ hiện ra ngay)
                                head -n 10 seeker-agent.tgz
                                
                                # Check size: Nếu < 2000 bytes thì chắc chắn là file lỗi
                                FILE_SIZE=$(du -b seeker-agent.tgz | cut -f1)
                                if [ "$FILE_SIZE" -lt 2000 ]; then
                                    echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
                                    echo "!!! LỖI: DOWNLOAD THẤT BẠI - FILE QUÁ NHỎ !!!"
                                    echo "Nội dung server trả về:"
                                    cat seeker-agent.tgz
                                    echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
                                    exit 1
                                fi
                            '''
                            
                            echo "--- 2. Install Agent ---"
                            sh 'npm config set strict-ssl false'
                            // Cài từ file đã tải (nếu bước trên thành công)
                            sh 'npm install --no-save ./seeker-agent.tgz'
                            
                            echo "--- 3. Start App with Seeker ---"
                            sh """
                                export SEEKER_SERVER_URL="${seekerUrl}"
                                export SEEKER_PROJECT_KEY="${projectKey}"
                                export SEEKER_ACCESS_TOKEN="${env.SEEKER_TOKEN}"
                                export SEEKER_AGENT_NAME="Jenkins-IAST-${env.BUILD_NUMBER}"
                                
                                # Tìm file agent
                                AGENT_PATH=""
                                if [ -f "node_modules/@seeker/agent/index.mjs" ]; then
                                    AGENT_PATH="node_modules/@seeker/agent/index.mjs"
                                elif [ -f "node_modules/seeker-agent/index.js" ]; then
                                    AGENT_PATH="node_modules/seeker-agent/index.js"
                                else
                                    AGENT_PATH=\$(find node_modules -name "index.mjs" | grep seeker | head -n 1)
                                fi

                                if [ -z "\$AGENT_PATH" ]; then
                                    echo "ERROR: Agent not found!"
                                    exit 1
                                fi
                                
                                echo ">>> Starting Node with Agent at: \$AGENT_PATH"
                                nohup node --import ./\$AGENT_PATH app.js > app_iast.log 2>&1 &
                                echo \$! > iast_app.pid
                            """

                            // Healthcheck
                            sh """
                                timeout=60
                                while ! curl -s http://localhost:${APP_PORT} > /dev/null; do
                                    sleep 2
                                    timeout=\$((timeout-2))
                                    if [ \$timeout -le 0 ]; then 
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
                        }
                    }
                }
            }
        }
    }
}
