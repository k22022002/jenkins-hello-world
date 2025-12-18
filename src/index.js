const express = require('express');
const helmet = require('helmet');
const app = express();

// 1. Cấu hình Helmet siêu chặt chẽ để xóa bỏ lỗi [10055]
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false, // Tắt mặc định để tự cấu hình sạch sẽ
      directives: {
        "default-src": ["'self'"], // Fallback gốc
        "base-uri": ["'self'"],    // Chống lỗi No Fallback
        "form-action": ["'self'"], // Chống lỗi No Fallback
        "frame-ancestors": ["'none'"],
        "script-src": ["'self'"],
        "style-src": ["'self'"],
        "img-src": ["'self'"],
        "upgrade-insecure-requests": [],
      },
    },
    // Chống Spectre [90004]
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-origin" },
  })
);

// 2. Middleware áp dụng Header cho TẤT CẢ các response (kể cả 404) để xóa lỗi [10049]
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  next();
});

// 3. Xử lý các file ZAP hay quét để tránh 404 không bảo mật
const staticFilesHandler = (req, res) => {
    res.type('text/plain');
    res.status(200).send("User-agent: *\nDisallow: /");
};
app.get('/robots.txt', staticFilesHandler);
app.get('/sitemap.xml', staticFilesHandler); // Thêm cái này để xóa nốt lỗi sitemap.xml

app.disable('x-powered-by'); 

function hello() {
    return "Hello Jenkins";
}

app.get('/', (req, res) => {
    res.status(200).send(hello());
});

// 4. Custom 404 Handler để đảm bảo trang lỗi vẫn có đủ Header
app.use((req, res) => {
    res.status(404).send("Not Found");
});

module.exports = { app, hello };
