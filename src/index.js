// src/index.js
const express = require('express');
const app = express();

// --- [THÊM DÒNG NÀY] ---
// Tắt header 'X-Powered-By' để hacker không biết mình dùng Express
app.disable('x-powered-by'); 
// -----------------------

const PORT = process.env.PORT || 3000;

function hello() {
    return "Hello Jenkins";
}

app.get('/', (req, res) => {
    res.status(200).send(hello());
});

/* istanbul ignore next */ 
if (require.main === module) {
    const server = app.listen(PORT, () => {
        console.log(`App is listening on port ${PORT}`);
    });
}

module.exports = { app, hello };
