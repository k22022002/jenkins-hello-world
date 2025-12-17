// src/index.js
const express = require('express');
const app = express();

// Lấy port từ biến môi trường (Docker sẽ truyền vào) hoặc dùng 3000
const PORT = process.env.PORT || 3000;

// Logic nghiệp vụ (Tách ra để dễ Unit Test)
function hello() {
    return "Hello Jenkins";
}

// Định nghĩa đường dẫn gốc (Route)
app.get('/', (req, res) => {
    res.send(hello());
});

// QUAN TRỌNG: Chỉ khởi động server khi file này được chạy trực tiếp
// (Để khi chạy Unit Test, nó không tự mở port gây lỗi)
if (require.main === module) {
    const server = app.listen(PORT, () => {
        console.log(`App is listening on port ${PORT}`);
    });

    // Xử lý tắt server gọn gàng (Graceful Shutdown) cho Docker
    process.on('SIGTERM', () => {
        server.close(() => {
            console.log('Process terminated');
        });
    });
}

// Export cả hàm hello (để test logic) và app (nếu muốn test integration sau này)
module.exports = hello;
