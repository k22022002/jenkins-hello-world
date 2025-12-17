// test/test.js
const request = require('supertest');
const { app, hello } = require('../src/index.js'); 

describe('Jenkins Hello World App', () => {

    // TEST 1: Unit Test (Kiểm tra logic hàm)
    // Test này bao phủ hàm hello()
    test('Unit Test: Hàm hello phải trả về "Hello Jenkins"', () => {
        const result = hello();
        expect(result).toBe("Hello Jenkins");
    });

    // TEST 2: Integration Test (Kiểm tra API chạy thực tế)
    // Test này bao phủ app.get('/')
    test('Integration Test: GET / phải trả về status 200', async () => {
        const response = await request(app).get('/');
        
        // Kiểm tra status code
        expect(response.statusCode).toBe(200);
        
        // Kiểm tra nội dung trả về
        expect(response.text).toBe("Hello Jenkins");
        
        // Kiểm tra bảo mật (Header x-powered-by phải bị tắt)
        expect(response.headers['x-powered-by']).toBeUndefined();
    });

});
