// src/index.js
const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;

function hello() {
    return "Hello Jenkins";
}

// Route này trước đây chưa được test, giờ sẽ được test
app.get('/', (req, res) => {
    res.status(200).send(hello());
});

// Chỉ chạy server khi file được gọi trực tiếp (node src/index.js)
// Khi Jest import file này, đoạn code trong if sẽ KHÔNG chạy (tránh lỗi Port in use)
/* istanbul ignore next */ 
if (require.main === module) {
    const server = app.listen(PORT, () => {
        console.log(`App is listening on port ${PORT}`);
    });
}

// Export dạng Object để test file có thể lấy cả app và hello
module.exports = { app, hello };
