pipeline {
    agent any

    tools {
        // Đảm bảo tên này khớp với Global Tool Configuration
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
                // Nhớ là đã bấm "Add Installer" cho tool này rồi nhé
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
                script {
                    echo '--- 3. Static Analysis (SonarCloud) ---'
                    
                    // BƯỚC SỬA LỖI:
                    // 1. Dùng lệnh của Jenkins để lấy đường dẫn tuyệt đối của Node vừa được load
                    def nodePath = sh(script: "which node", returnStdout: true).trim()
                    echo "NodeJS path found: ${nodePath}"

                    withSonarQubeEnv('SonarCloud') { 
                        // 2. Dùng dấu nháy kép """ (Double Quotes) thay vì '''
                        // Để chúng ta có thể chèn biến ${nodePath} vào lệnh
                        sh """
                        npx sonar-scanner \
                            -Dsonar.projectKey=k22022002_jenkins-hello-world \
                            -Dsonar.organization=k22022002 \
                            -Dsonar.sources=src \
                            -Dsonar.tests=test \
                            -Dsonar.css.node=true \
                            -Dsonar.host.url=https://sonarcloud.io \
                            -Dsonar.nodejs.executable="${nodePath}"
                        """
                    }
                }
            }
        }

        stage('Build & Test') {
            steps {
                echo '--- 4. Build & Test ---'
                sh 'npm test'
            }
        }
    }
}
