pipeline {
    agent any // Chạy trực tiếp trên máy host, không dùng plugin Docker vội
    stages {
        stage('Debug Docker') {
            steps {
                script {
                    // 1. Kiểm tra Docker trên máy host
                    sh 'docker --version'
                    
                    // 2. Thử pull image thủ công
                    sh 'docker pull node:20'
                    
                    // 3. Thử chạy container thủ công (mô phỏng cách Jenkins làm)
                    // Lệnh này chạy container, mount socket, và chạy lệnh id
                    sh 'docker run --rm --entrypoint="" -v /var/run/docker.sock:/var/run/docker.sock node:20 id'
                }
            }
        }
    }
}
