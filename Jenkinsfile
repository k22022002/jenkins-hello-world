pipeline {
    agent any

    tools {
        nodejs 'NodeJS' 
        // Đảm bảo máy Jenkins đã cài git, jq (để xử lý JSON cho SLSA)
    }

    environment {
        // Định nghĩa tên Artifact cho chuẩn SLSA
        ARTIFACT_NAME = "jenkins-hello-world-${BUILD_NUMBER}.tgz"
        PROVENANCE_FILE = "provenance.json"
    }

    stages {
        stage('1. Checkout & Init') {
            steps {
                echo '--- [DSOMM] Source Code Management ---'
                checkout scm
                sh 'npm install'
            }
        }

        // --- DSOMM Level 1: Security & Quality ---
        
        stage('2. Secret Scanning (DSOMM)') {
            steps {
                echo '--- [DSOMM] Secret Detection ---'
                // Kiểm tra xem có lỡ commit key/password vào code không.
                // Ở level 1, ta có thể dùng script đơn giản hoặc tool như Gitleaks/Trufflehog.
                // Ví dụ dưới dùng grep đơn giản để demo (Bạn nên cài Gitleaks plugin để tốt hơn)
                script {
                    try {
                        // Tìm các từ khóa nhạy cảm trong code mới thay đổi
                        sh 'grep -rE "password|secret|token|key" src/ || echo "No secrets found"'
                    } catch (Exception e) {
                        echo "Warning: Potential secrets found or scan failed."
                    }
                }
            }
        }

        stage('3. SCA - OWASP Dependency Check (DSOMM)') {
            steps {
                echo '--- [DSOMM] Software Composition Analysis ---'
                dependencyCheck additionalArguments: '--format HTML --format XML --failOnCVSS 7.0', 
                                odcInstallation: 'OWASP-Dependency-Check'
            }
            post {
                always {
                    dependencyCheckPublisher pattern: 'dependency-check-report.xml'
                }
            }
        }

        stage('4. SAST - Code Quality (DSOMM)') {
            steps {
                script {
                    echo '--- [DSOMM] Static Application Security Testing ---'
                    def nodePath = sh(script: "which node", returnStdout: true).trim()
                    
                    withSonarQubeEnv('SonarCloud') { 
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

        // --- SLSA v1.2: Build & Provenance ---

        stage('5. Build Artifact (SLSA Build)') {
            steps {
                echo '--- [SLSA] Creating Immutable Artifact ---'
                // Thay vì chỉ test, ta phải đóng gói sản phẩm (npm pack tạo ra file .tgz)
                sh 'npm test'
                sh "npm pack && mv *.tgz ${ARTIFACT_NAME}"
            }
        }

        stage('6. Generate Provenance (SLSA Provenance)') {
            steps {
                script {
                    echo '--- [SLSA] Generating Provenance Metadata ---'
                    // 1. Tính toán mã băm (Digest) của file artifact vừa tạo
                    def artifactSha256 = sh(script: "sha256sum ${ARTIFACT_NAME} | awk '{print \$1}'", returnStdout: true).trim()
                    
                    // 2. Lấy thông tin Git commit hiện tại
                    def gitCommit = sh(script: "git rev-parse HEAD", returnStdout: true).trim()
                    def gitUrl = sh(script: "git config --get remote.origin.url", returnStdout: true).trim()

                    // 3. Tạo file JSON Provenance (Chứng minh nguồn gốc)
                    // Đây là dạng đơn giản của SLSA Predicate
                    def provenanceContent = """
                    {
                        "builder": { "id": "jenkins-node-agent" },
                        "buildType": "npm-pack",
                        "invocation": {
                            "configSource": {
                                "uri": "${gitUrl}",
                                "digest": { "sha1": "${gitCommit}" },
                                "entryPoint": "Jenkinsfile"
                            }
                        },
                        "subject": [{
                            "name": "${ARTIFACT_NAME}",
                            "digest": { "sha256": "${artifactSha256}" }
                        }]
                    }
                    """
                    writeFile file: PROVENANCE_FILE, text: provenanceContent
                    echo "Generated Provenance for ${ARTIFACT_NAME} with SHA256: ${artifactSha256}"
                }
            }
        }
    }

    post {
        success {
            // Lưu trữ Artifact và Provenance lại trên Jenkins
            archiveArtifacts artifacts: "${ARTIFACT_NAME}, ${PROVENANCE_FILE}, dependency-check-report.html", allowEmptyArchive: true
            echo "Pipeline finished successfully with DSOMM L1 & SLSA v1.2 artifacts."
        }
        failure {
            echo "Pipeline failed."
        }
    }
}
