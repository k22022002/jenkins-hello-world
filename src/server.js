// src/server.js
const { app } = require('./index');
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    console.log(`App is listening on port ${PORT}`);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
    server.close(() => {
        console.log('Process terminated');
    });
});
