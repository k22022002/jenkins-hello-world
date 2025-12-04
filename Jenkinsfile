pipeline {
    agent any

    tools {
        // Yêu cầu: Đã cấu hình NodeJS tên là 'NodeJS' trong Global Tools
        nodejs 'NodeJS' 
    }

    stages {
        stage('Checkout & Install') {
            steps {
                echo '--- 1. Checkout & Install Dependencies ---'
                // Cài đặt thư viện để có node_modules cho việc quét
                sh 'npm install'
            }
        }

        stage('Security Check (OWASP)') {
            steps {
                echo '--- 2. OWASP Dependency Check ---'
                // Yêu cầu: Đã cấu hình Tool tên 'OWASP-Dependency-Check' và ĐÃ CHỌN VERSION cài đặt
                dependencyCheck additionalArguments: '--format HTML --format XML --failOnCVSS 7.0', 
                                odcInstallation: 'OWASP-Dependency-Check'
            }
            post {
                always {
                    // Lưu report lại để xem trên giao diện Jenkins
                    dependencyCheckPublisher pattern: 'dependency-check-report.xml'
                }
            }
        }

        stage('Code Quality (SonarQube)') {
            steps {
                echo '--- 3. Static Analysis (SonarQube) ---'
                // Yêu cầu: Đã cấu hình Server SonarQube tên 'SonarQube-Server' trong System Config
                withSonarQubeEnv('SonarQube-Server') { 
                    // Chạy lệnh quét
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
                timeout(time: 5, unit: 'MINUTES') {
                    // Đợi SonarQube trả kết quả Pass/Fail về
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        stage('Build & Test') {
            steps {
                echo '--- 5. Build & Test (Only runs if Security & Quality passed) ---'
                sh 'npm test'
            }
        }
    }

    post {
        failure {
            echo '❌ Pipeline thất bại! Vui lòng kiểm tra lại lỗi bảo mật hoặc chất lượng code.'
        }
        success {
            echo '✅ Pipeline thành công! Code an toàn và đạt chuẩn.'
        }
    }
}
