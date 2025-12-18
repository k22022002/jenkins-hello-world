// src/server.js
const { app } = require('./index'); // Đúng: gọi index.js cùng thư mục
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server đang chạy tại http://0.0.0.0:${PORT}`);
});

process.on('SIGTERM', () => {
    server.close(() => { console.log('Process terminated'); });
});
