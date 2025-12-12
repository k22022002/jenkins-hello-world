// test/test.js
const hello = require('../src/index.js');

describe('Jenkins Hello World App', () => {
    
    test('Hàm hello phải trả về "Hello Jenkins"', () => {
        // Thực thi hàm
        const result = hello();
        
        // Kiểm tra kết quả (Thay thế cho assert.strictEqual)
        expect(result).toBe("Hello Jenkins");
    });

});
