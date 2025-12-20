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
			    // 1. Tắt chế độ kiểm tra chứng chỉ bảo mật
                            sh 'npm config set strict-ssl false'
                            // 2. Chuyển sang dùng HTTP thường thay vì HTTPS (nếu cần thiết)
                            sh 'npm config set registry "http://registry.npmjs.org/"'
                            // --------------------------------------//
                            echo "--- Starting App with Seeker Agent ---"
                            sh """
                                export SEEKER_SERVER_URL="${seekerUrl}"
                                export SEEKER_ACCESS_TOKEN="${env.SEEKER_TOKEN}"
                                export SEEKER_PROJECT_KEY="${projectKey}"
                                export SEEKER_AGENT_NAME="Jenkins-Test-IAST-${env.BUILD_NUMBER}"
                                
                                nohup node -r @synopsys/seeker-agent/index.js app.js > app_iast.log 2>&1 &
                                echo \$! > iast_app.pid
                            """

                            // Healthcheck
                            sh """
                                timeout=60
                                while ! curl -s http://localhost:${APP_PORT} > /dev/null; do
                                    sleep 2
                                    timeout=\$((timeout-2))
                                    if [ \$timeout -le 0 ]; then 
                                        echo "TIMEOUT!"
                                        cat app_iast.log
                                        exit 1
                                    fi
                                done
                                echo "App is READY!"
                            """

                            // Generate Traffic
                            echo "--- Generating Traffic ---"
                            // Nếu node_modules cũ còn, lệnh test sẽ chạy rất nhanh
                            sh 'npm test' 
                            sh "curl -s http://localhost:${APP_PORT}/"

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
