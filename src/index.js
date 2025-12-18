const express = require('express');
const helmet = require('helmet');
const app = express();

// 1. Cấu hình Helmet nâng cao
app.use(
  helmet({
    // Giải quyết lỗi CSP [10055] bằng cách định nghĩa default-src
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "upgrade-insecure-requests": [],
      },
    },
    // Giải quyết lỗi Spectre [90004] (Cơ chế cô lập tài nguyên)
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-origin" },
  })
);

// 2. Header thủ công cho Permissions Policy [10063]
app.use((req, res, next) => {
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  // 3. Giải quyết lỗi Cache [10049]
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// 4. Thêm route robots.txt để tránh lỗi 404 làm nhiễu báo cáo ZAP
app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send("User-agent: *\nDisallow: /");
});

app.disable('x-powered-by'); 

function hello() {
    return "Hello Jenkins";
}

app.get('/', (req, res) => {
    res.status(200).send(hello());
});

module.exports = { app, hello };
