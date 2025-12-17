// test/test.js
const hello = require('../src/index.js');

describe('Jenkins Hello World App', () => {
    
    test('Hàm hello phải trả về "Hello Jenkins"', () => {
        // Thực thi hàm (Lúc này server KHÔNG chạy, chỉ logic chạy)
        const result = hello();
        
        // Kiểm tra kết quả
        expect(result).toBe("Hello Jenkins");
    });

});
