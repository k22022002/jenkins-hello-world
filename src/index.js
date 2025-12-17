// src/index.js
const express = require('express');
const app = express();

// Tắt header fix lỗi bảo mật
app.disable('x-powered-by'); 

function hello() {
    return "Hello Jenkins";
}

// Định nghĩa Route
app.get('/', (req, res) => {
    res.status(200).send(hello());
});

// Chỉ export app và hàm, KHÔNG chạy lệnh listen ở đây
module.exports = { app, hello };
