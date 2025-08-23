const request = require('supertest');
const app = require('../index');
const path = require('path');
const fs = require('fs');

describe('Stem Separation API', () => {
    
    describe('Health Check', () => {
        test('GET /health should return service status', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);

            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('service', 'Stem Separation API');
            expect(response.body).toHaveProperty('author', 'Sergie Code');
            expect(response.body).toHaveProperty('timestamp');
        });
    });

    describe('API Documentation', () => {
        test('GET /api should return API information', async () => {
            const response = await request(app)
                .get('/api')
                .expect(200);

            expect(response.body).toHaveProperty('service', 'Stem Separation API');
            expect(response.body).toHaveProperty('author', 'Sergie Code');
            expect(response.body).toHaveProperty('endpoints');
            expect(response.body.endpoints).toHaveProperty('separate');
            expect(response.body.endpoints).toHaveProperty('models');
        });
    });

    describe('Models Endpoint', () => {
        test('GET /api/audio/models should return available models', async () => {
            const response = await request(app)
                .get('/api/audio/models')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body).toHaveProperty('models');
            expect(response.body).toHaveProperty('defaultModel');
            expect(response.body).toHaveProperty('supportedDevices');
            expect(Array.isArray(response.body.models)).toBe(true);
        });
    });

    describe('File Upload Validation', () => {
        test('POST /api/audio/separate without file should return error', async () => {
            const response = await request(app)
                .post('/api/audio/separate')
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('No audio file provided');
        });

        test('POST /api/audio/separate with non-audio file should return error', async () => {
            // Create a temporary text file for testing
            const testFilePath = path.join(__dirname, 'test.txt');
            fs.writeFileSync(testFilePath, 'This is not an audio file');

            const response = await request(app)
                .post('/api/audio/separate')
                .attach('audio', testFilePath)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Invalid file type');

            // Cleanup
            fs.unlinkSync(testFilePath);
        });

        test('POST /api/audio/separate with invalid model should return error', async () => {
            // Create a dummy audio file (just for validation testing)
            const testFilePath = path.join(__dirname, 'test.mp3');
            fs.writeFileSync(testFilePath, Buffer.alloc(1024)); // 1KB dummy file

            const response = await request(app)
                .post('/api/audio/separate')
                .attach('audio', testFilePath)
                .field('model', 'invalid_model')
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid model');

            // Cleanup
            fs.unlinkSync(testFilePath);
        });
    });

    describe('Job Status', () => {
        test('GET /api/audio/status/invalid-uuid should return error', async () => {
            const response = await request(app)
                .get('/api/audio/status/invalid-uuid')
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid job ID');
        });

        test('GET /api/audio/status/valid-uuid should return not found', async () => {
            const validUuid = '123e4567-e89b-12d3-a456-426614174000';
            const response = await request(app)
                .get(`/api/audio/status/${validUuid}`)
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Job not found');
        });
    });

    describe('Download Endpoint', () => {
        test('GET /api/audio/download/invalid-uuid/vocals should return error', async () => {
            const response = await request(app)
                .get('/api/audio/download/invalid-uuid/vocals')
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid job ID');
        });

        test('GET /api/audio/download/valid-uuid/invalid-stem should return error', async () => {
            const validUuid = '123e4567-e89b-12d3-a456-426614174000';
            const response = await request(app)
                .get(`/api/audio/download/${validUuid}/invalid_stem`)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid stem name');
        });
    });

    describe('Recent Jobs', () => {
        test('GET /api/audio/jobs should return jobs list', async () => {
            const response = await request(app)
                .get('/api/audio/jobs')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body).toHaveProperty('jobs');
            expect(response.body).toHaveProperty('total');
            expect(Array.isArray(response.body.jobs)).toBe(true);
        });
    });

    describe('404 Handler', () => {
        test('GET /non-existent-endpoint should return 404', async () => {
            const response = await request(app)
                .get('/non-existent-endpoint')
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Endpoint not found');
            expect(response.body).toHaveProperty('availableEndpoints');
        });
    });

    describe('CORS Headers', () => {
        test('OPTIONS request should return CORS headers', async () => {
            const response = await request(app)
                .options('/api/audio/models')
                .expect(200);

            expect(response.headers).toHaveProperty('access-control-allow-origin');
            expect(response.headers).toHaveProperty('access-control-allow-methods');
        });
    });
});
