const express = require('express');
const helmet = require('helmet');
const app = express();
// Sử dụng helmet để fix các lỗi ZAP vừa quét thấy
app.use(helmet());

// Fix lỗi bảo mật
app.disable('x-powered-by'); 

function hello() {
    return "Hello Jenkins";
}

// Định nghĩa Route
app.get('/', (req, res) => {
    res.status(200).send(hello());
});

// Chỉ export, KHÔNG có app.listen ở đây!
module.exports = { app, hello };
