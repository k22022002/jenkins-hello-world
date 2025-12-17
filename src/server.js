const { app } = require('./index');
const PORT = process.env.PORT || 3000;

// Đoạn code này unit test không chạy qua được, nên ta để riêng ra đây
const server = app.listen(PORT, () => {
    console.log(`App is listening on port ${PORT}`);
});

process.on('SIGTERM', () => {
    server.close(() => {
        console.log('Process terminated');
    });
});
