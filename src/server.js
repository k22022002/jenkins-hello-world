const { app } = require('./index');
const PORT = process.env.PORT || 3000;

// Thay đổi quan trọng ở đây: Thêm '0.0.0.0'
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`App is listening on port ${PORT}`);
});

process.on('SIGTERM', () => {
    server.close(() => {
        console.log('Process terminated');
    });
});
