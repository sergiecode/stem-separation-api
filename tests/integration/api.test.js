const request = require('supertest');
const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const app = require('../index');

describe('Integration Tests', () => {
    let server;
    let io;
    let clientSocket;
    let serverSocket;

    beforeAll((done) => {
        server = createServer(app);
        io = new Server(server);
        server.listen(() => {
            const port = server.address().port;
            clientSocket = new Client(`http://localhost:${port}`);
            io.on('connection', (socket) => {
                serverSocket = socket;
            });
            clientSocket.on('connect', done);
        });
    });

    afterAll(() => {
        server.close();
        io.close();
        clientSocket.close();
    });

    describe('API Health Check', () => {
        test('should return health status', async () => {
            const response = await request(app)
                .get('/api/health')
                .expect(200);

            expect(response.body).toEqual({
                status: 'OK',
                timestamp: expect.any(String),
                uptime: expect.any(Number),
                version: '1.0.0',
                environment: 'test'
            });
        });
    });

    describe('Audio Upload and Processing Flow', () => {
        test('should handle complete audio processing workflow', async () => {
            // Create a mock audio file
            const audioBuffer = Buffer.from('fake audio data');
            
            // Upload audio file
            const uploadResponse = await request(app)
                .post('/api/audio/separate')
                .attach('audio', audioBuffer, 'test.mp3')
                .field('model', 'demucs')
                .expect(202);

            expect(uploadResponse.body).toMatchObject({
                jobId: expect.any(String),
                status: 'queued',
                message: expect.any(String)
            });

            const jobId = uploadResponse.body.jobId;

            // Check job status
            const statusResponse = await request(app)
                .get(`/api/audio/status/${jobId}`)
                .expect(200);

            expect(statusResponse.body).toMatchObject({
                jobId,
                status: expect.stringMatching(/queued|processing|completed|failed/),
                progress: expect.any(Number)
            });
        });

        test('should reject invalid file types', async () => {
            const textBuffer = Buffer.from('not an audio file');
            
            const response = await request(app)
                .post('/api/audio/separate')
                .attach('audio', textBuffer, 'test.txt')
                .field('model', 'demucs')
                .expect(400);

            expect(response.body).toMatchObject({
                error: 'Invalid file type',
                message: expect.stringContaining('audio')
            });
        });

        test('should reject files that are too large', async () => {
            // Create a buffer larger than the limit (assuming 100MB limit)
            const largeBuffer = Buffer.alloc(101 * 1024 * 1024, 'a');
            
            const response = await request(app)
                .post('/api/audio/separate')
                .attach('audio', largeBuffer, 'large.mp3')
                .field('model', 'demucs')
                .expect(413);

            expect(response.body).toMatchObject({
                error: 'File too large',
                message: expect.any(String)
            });
        });
    });

    describe('WebSocket Integration', () => {
        test('should establish WebSocket connection', (done) => {
            clientSocket.on('connect', () => {
                expect(clientSocket.connected).toBe(true);
                done();
            });
        });

        test('should join job room for progress updates', (done) => {
            const jobId = 'test-job-123';
            
            clientSocket.emit('join-job', jobId);
            
            serverSocket.on('join-job', (receivedJobId) => {
                expect(receivedJobId).toBe(jobId);
                done();
            });
        });

        test('should receive progress updates', (done) => {
            const jobId = 'test-job-456';
            const progressData = {
                jobId,
                status: 'processing',
                progress: 50,
                message: 'Separating stems...'
            };

            clientSocket.on('progress-update', (data) => {
                expect(data).toEqual(progressData);
                done();
            });

            // Simulate server sending progress update
            setTimeout(() => {
                io.to(`job-${jobId}`).emit('progress-update', progressData);
            }, 100);
        });
    });

    describe('Model Management', () => {
        test('should list available models', async () => {
            const response = await request(app)
                .get('/api/audio/models')
                .expect(200);

            expect(response.body).toEqual({
                models: expect.arrayContaining([
                    expect.objectContaining({
                        id: expect.any(String),
                        name: expect.any(String),
                        description: expect.any(String)
                    })
                ])
            });
        });

        test('should validate model selection', async () => {
            const audioBuffer = Buffer.from('fake audio data');
            
            const response = await request(app)
                .post('/api/audio/separate')
                .attach('audio', audioBuffer, 'test.mp3')
                .field('model', 'invalid-model')
                .expect(400);

            expect(response.body).toMatchObject({
                error: 'Validation failed',
                details: expect.any(Array)
            });
        });
    });

    describe('Error Handling', () => {
        test('should handle 404 errors gracefully', async () => {
            const response = await request(app)
                .get('/api/nonexistent')
                .expect(404);

            expect(response.body).toMatchObject({
                error: 'Not Found',
                message: 'Route not found',
                statusCode: 404
            });
        });

        test('should handle invalid JSON in request body', async () => {
            const response = await request(app)
                .post('/api/audio/separate')
                .send('invalid json')
                .set('Content-Type', 'application/json')
                .expect(400);

            expect(response.body).toMatchObject({
                error: expect.any(String),
                statusCode: 400
            });
        });

        test('should handle missing required fields', async () => {
            const response = await request(app)
                .post('/api/audio/separate')
                .expect(400);

            expect(response.body).toMatchObject({
                error: expect.any(String),
                message: expect.stringContaining('audio')
            });
        });
    });

    describe('Rate Limiting', () => {
        test('should enforce rate limits', async () => {
            const audioBuffer = Buffer.from('fake audio data');
            
            // Make multiple requests quickly to trigger rate limit
            const requests = Array(20).fill().map(() => 
                request(app)
                    .post('/api/audio/separate')
                    .attach('audio', audioBuffer, 'test.mp3')
                    .field('model', 'demucs')
            );

            const responses = await Promise.all(requests);
            
            // At least some requests should be rate limited
            const rateLimitedResponses = responses.filter(r => r.status === 429);
            expect(rateLimitedResponses.length).toBeGreaterThan(0);
        });
    });

    describe('CORS Configuration', () => {
        test('should handle CORS preflight requests', async () => {
            const response = await request(app)
                .options('/api/audio/separate')
                .set('Origin', 'http://localhost:3000')
                .set('Access-Control-Request-Method', 'POST')
                .set('Access-Control-Request-Headers', 'Content-Type')
                .expect(204);

            expect(response.headers['access-control-allow-origin']).toBe('*');
            expect(response.headers['access-control-allow-methods']).toContain('POST');
        });
    });

    describe('Security Headers', () => {
        test('should include security headers', async () => {
            const response = await request(app)
                .get('/api/health')
                .expect(200);

            expect(response.headers).toMatchObject({
                'x-content-type-options': 'nosniff',
                'x-frame-options': 'DENY',
                'x-xss-protection': '1; mode=block'
            });
        });
    });
});
