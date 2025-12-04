pipeline {
    agent any

    tools {
        nodejs 'NodeJS' // Tên tool NodeJS đã cấu hình
        // Khai báo tool OWASP nếu dùng cú pháp tool (hoặc dùng step dependencyCheck bên dưới)
    }

    stages {
        stage('Checkout & Install') {
            steps {
                echo '--- 1. Checkout & Install Dependencies ---'
                // Checkout code (tự động nếu dùng Pipeline from SCM)
                // Cài node_modules để có cái cho OWASP quét
                sh 'npm install'
            }
        }

        stage('Security Check (OWASP)') {
            steps {
                echo '--- 2. OWASP Dependency Check ---'
                // Sửa lại đoạn này:
                dependencyCheck additionalArguments: '--format HTML --format XML --failOnCVSS 7.0', 
                                odcInstallation: 'OWASP-Dependency-Check'
            }
            post {
                always {
                    // Lưu report lại dù build có fail hay pass
                    dependencyCheckPublisher pattern: 'dependency-check-report.xml'
                }
            }
        }

        stage('Code Quality (SonarQube)') {
            steps {
                echo '--- 3. Static Analysis (SonarQube) ---'
                // 'SonarQube-Server' là tên bạn đặt trong Manage Jenkins > System
                withSonarQubeEnv('SonarQube-Server') { 
                    // Lệnh chạy scanner. Yêu cầu trong root project có file sonar-project.properties hoặc truyền tham số trực tiếp
                    sh '''
                    npx sonar-scanner \
                        -Dsonar.projectKey=jenkins-hello-world \
                        -Dsonar.sources=src \
                        -Dsonar.tests=test \
                        -Dsonar.css.node=true
                    '''
                }
            }
        }

        stage('Quality Gate') {
            steps {
                echo '--- 4. Checking Quality Gate ---'
                // Chờ SonarQube trả kết quả về. 
                // Nếu trạng thái là FAILED (không đạt tiêu chuẩn) -> abortPipeline: true sẽ Break Build.
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        stage('Build & Test') {
            steps {
                echo '--- 5. Build & Test (Only runs if Security & Quality passed) ---'
                // Chỉ chạy đến đây nếu không có lỗ hổng bảo mật và code sạch đẹp
                sh 'npm test'
            }
        }
    }

    post {
        failure {
            echo '❌ Pipeline đã bị chặn lại do lỗi Bảo mật hoặc Chất lượng Code không đạt!'
        }
        success {
            echo '✅ Chúc mừng! Code sạch, an toàn và chạy tốt.'
        }
    }
}
