// test/test.js
const request = require('supertest');
const { app, hello } = require('../src/index.js'); 

describe('Jenkins Hello World App', () => {

    // Test 1: Unit Test hàm logic thuần túy
    test('Unit Test: Hàm hello phải trả về "Hello Jenkins"', () => {
        const result = hello();
        expect(result).toBe("Hello Jenkins");
    });

    // Test 2: Integration Test (Quan trọng để tăng Coverage)
    // Test này sẽ kích hoạt các dòng code trong app.get('/')
    test('Integration Test: GET / phải trả về status 200', async () => {
        const response = await request(app).get('/');
        
        // Kiểm tra API hoạt động đúng
        expect(response.statusCode).toBe(200);
        expect(response.text).toBe("Hello Jenkins");
        
        // --- [KIỂM TRA FIX BẢO MẬT] ---
        // Đảm bảo header 'x-powered-by' đã bị tắt (undefined)
        expect(response.headers['x-powered-by']).toBeUndefined();
    });

});
