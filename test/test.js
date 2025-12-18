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
test('Integration Test: Kiểm tra các Security Headers', async () => {
        const response = await request(app).get('/');
        
        expect(response.statusCode).toBe(200);
        
        // Kiểm tra các header mà Helmet đã thêm vào
        expect(response.headers['x-frame-options']).toBe('SAMEORIGIN'); // Chống Clickjacking
        expect(response.headers['x-content-type-options']).toBe('nosniff'); // Chống MIME sniffing
        expect(response.headers['content-security-policy']).toBeDefined(); // Có CSP
    });
});
