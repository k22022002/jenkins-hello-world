// test/test.js
const request = require('supertest');
const { app, hello } = require('../src/index.js'); // Import dạng destructuring

describe('Jenkins Hello World App', () => {

    // 1. Unit Test: Kiểm tra logic hàm (như cũ)
    test('Unit Test: Hàm hello phải trả về "Hello Jenkins"', () => {
        const result = hello();
        expect(result).toBe("Hello Jenkins");
    });

    // 2. Integration Test: Kiểm tra API endpoint (MỚI)
    // Cái này sẽ tăng coverage cho đoạn app.get('/')
    test('Integration Test: GET / phải trả về status 200 và text "Hello Jenkins"', async () => {
        const response = await request(app).get('/');
        
        // Kiểm tra HTTP Status Code
        expect(response.statusCode).toBe(200);
        
        // Kiểm tra nội dung trả về
        expect(response.text).toBe("Hello Jenkins");
    });

});
