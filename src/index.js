// src/index.js
const express = require('express');
const app = express();

// --- [FIX BẢO MẬT] ---
// Tắt header này để hacker không biết server dùng Express
// Đây là fix cho lỗi trong ảnh image_dc1852.png
app.disable('x-powered-by'); 

const PORT = process.env.PORT || 3000;

function hello() {
    return "Hello Jenkins";
}

// Định nghĩa Route
app.get('/', (req, res) => {
    res.status(200).send(hello());
});

// --- [TĂNG COVERAGE LÊN 100%] ---
// Dòng comment này bảo Jest: "Bỏ qua coverage cho khối if này"
// Vì đây là đoạn khởi động server, Unit test không chạy qua nên coverage bị thấp.
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
