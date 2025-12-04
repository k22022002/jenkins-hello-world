pipeline {
    agent any 
    
    // Khai báo các tools cần thiết (nếu server Jenkins đã cài sẵn Nodejs thì bỏ qua phần này)
    tools {
        nodejs 'NodeJS' // Tên này phải khớp với tên bạn cấu hình trong Global Tool Configuration của Jenkins
    }

    stages {
        stage('Build') {
            steps {
                echo 'Building...'
                // Cài đặt các thư viện phụ thuộc
                sh 'npm install' 
            }
        }
        
        stage('Test') {
            steps {
                echo 'Testing...'
                // Chạy file test đã viết ở trên
                sh 'npm test' 
            }
        }
        
        stage('Deploy') {
            steps {
                echo 'Deploying...'
                // Giả lập bước deploy
                sh 'echo "Deploy thành công!"' 
            }
        }
    }
    
    post {
        always {
            echo 'Pipeline đã chạy xong.'
        }
        failure {
            echo 'Có lỗi xảy ra trong quá trình build/test.'
        }
    }
}
