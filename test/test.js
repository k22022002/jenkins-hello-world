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
    test('Integration Test: Sitemap và Robots phải trả về 200 OK', async () => {
        const robots = await request(app).get('/robots.txt');
        const sitemap = await request(app).get('/sitemap.xml');
        
        expect(robots.statusCode).toBe(200);
        expect(sitemap.statusCode).toBe(200);
        expect(robots.headers['cache-control']).toContain('no-store');
    });
});
