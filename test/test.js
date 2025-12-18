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
test('Integration Test: Kiểm tra cấu hình bảo mật nâng cao', async () => {
    const response = await request(app).get('/');
    
    expect(response.statusCode).toBe(200);
    // Kiểm tra Spectre protection
    expect(response.headers['cross-origin-opener-policy']).toBe('same-origin');
    // Kiểm tra Cache control
    expect(response.headers['cache-control']).toContain('no-store');
    // Kiểm tra Permissions Policy
    expect(response.headers['permissions-policy']).toBeDefined();
});
});
