pipeline {
    agent any

    tools {
        // Yêu cầu: Đã cài NodeJS tên 'NodeJS' trong Manage Jenkins -> Tools
        nodejs 'NodeJS' 
    }

    stages {
        stage('Checkout & Install') {
            steps {
                echo '--- 1. Checkout & Install Dependencies ---'
                sh 'npm install'
            }
        }

        stage('Security Check (OWASP)') {
            steps {
                echo '--- 2. OWASP Dependency Check ---'
                // QUAN TRỌNG: Bạn phải vào Manage Jenkins > Tools > Dependency-Check
                // Bấm "Add Installer" -> chọn Version (ví dụ 9.0.9) thì bước này mới chạy được.
                dependencyCheck additionalArguments: '--format HTML --format XML --failOnCVSS 7.0', 
                                odcInstallation: 'OWASP-Dependency-Check'
            }
            post {
                always {
                    dependencyCheckPublisher pattern: 'dependency-check-report.xml'
                }
            }
        }

        stage('Code Quality (SonarCloud)') {
            steps {
                echo '--- 3. Static Analysis (SonarCloud) ---'
                // Yêu cầu: Đã tạo System Configuration tên 'SonarCloud'
                withSonarQubeEnv('SonarCloud') { 
                    sh '''
                    npx sonar-scanner \
                        -Dsonar.projectKey=k22022002_jenkins-hello-world \
                        -Dsonar.organization=k22022002 \
                        -Dsonar.sources=src \
                        -Dsonar.tests=test \
                        -Dsonar.css.node=true \
                        -Dsonar.host.url=https://sonarcloud.io
			-Dsonar.nodejs.executable=$(which node)
                    '''
                }
            }
        }

        // Tạm thời comment bước Quality Gate vì bạn đang chạy localhost
        // SonarCloud không thể gọi ngược về máy bạn để báo kết quả được.
        /*
        stage('Quality Gate') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }
        */

        stage('Build & Test') {
            steps {
                echo '--- 4. Build & Test ---'
                sh 'npm test'
            }
        }
    }
}
