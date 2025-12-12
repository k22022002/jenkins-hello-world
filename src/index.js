// src/index.js
function hello() {
    return "Hello Jenkins";
}

// Quan trọng: Phải export để file test có thể import được
module.exports = hello;
