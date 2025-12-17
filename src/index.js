// src/index.js
const express = require('express');
const app = express();

// --- [FIX BẢO MẬT] ---
// Tắt header này để SonarQube không báo lỗi "Security Hotspot" (như trong ảnh image_dc1852.png)
// Giúp che giấu thông tin server đang dùng Express
app.disable('x-powered-by'); 

const PORT = process.env.PORT || 3000;

function hello() {
    return "Hello Jenkins";
}

// Định nghĩa Route
app.get('/', (req, res) => {
    res.status(200).send(hello());
});

// --- [TĂNG COVERAGE] ---
// Dòng comment đặc biệt này bảo Jest: "Đừng tính coverage cho khối if này"
// Vì đây là code khởi động server, Unit Test không chạy qua đây nên coverage bị thấp.
/* istanbul ignore next */ 
if (require.main === module) {
    const server = app.listen(PORT, () => {
        console.log(`App is listening on port ${PORT}`);
    });

    // Xử lý tắt server gọn gàng (Graceful Shutdown)
    process.on('SIGTERM', () => {
        server.close(() => {
            console.log('Process terminated');
        });
    });
}

// Export cả app (cho test integration) và hàm hello (cho unit test)
module.exports = { app, hello };
