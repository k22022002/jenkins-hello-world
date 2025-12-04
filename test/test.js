// test/test.js
const hello = require('../src/index.js');
const assert = require('assert');

try {
    const result = hello();
    // Kiểm tra xem hàm có trả về đúng "Hello Jenkins" không
    assert.strictEqual(result, "Hello Jenkins");
    console.log("✅ Test Passed!");
} catch (e) {
    console.error("❌ Test Failed!");
    console.error(e);
    process.exit(1); // Báo lỗi cho Jenkins biết
}
