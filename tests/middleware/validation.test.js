const {
    validateAudioFile,
    validateProcessingOptions,
    validateJobId,
    validateStemName,
    rateLimiter,
    validateRequestSize
} = require('../../middleware/validation');

const fs = require('fs').promises;
const path = require('path');

// Mock fs promises
jest.mock('fs/promises');

describe('Validation Middleware', () => {
    let req, res, next;

    beforeEach(() => {
        req = {
            file: null,
            body: {},
            params: {},
            headers: {},
            ip: '127.0.0.1'
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };

        next = jest.fn();

        jest.clearAllMocks();
    });

    describe('validateAudioFile', () => {
        test('should pass validation for valid audio file', async () => {
            req.file = {
                path: '/test/audio.mp3',
                originalname: 'song.mp3'
            };

            fs.stat.mockResolvedValue({ size: 1024 * 1024 }); // 1MB
            fs.unlink.mockResolvedValue();

            await validateAudioFile(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        test('should reject when no file provided', async () => {
            req.file = null;

            await validateAudioFile(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'No audio file provided',
                message: 'Please upload an audio file using the "audio" field'
            });
            expect(next).not.toHaveBeenCalled();
        });

        test('should reject empty file', async () => {
            req.file = {
                path: '/test/empty.mp3',
                originalname: 'empty.mp3'
            };

            fs.stat.mockResolvedValue({ size: 0 });
            fs.unlink.mockResolvedValue();

            await validateAudioFile(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Uploaded file is empty',
                message: 'The uploaded file contains no data'
            });
            expect(fs.unlink).toHaveBeenCalledWith('/test/empty.mp3');
        });

        test('should reject invalid file extension', async () => {
            req.file = {
                path: '/test/document.txt',
                originalname: 'document.txt'
            };

            fs.stat.mockResolvedValue({ size: 1024 });
            fs.unlink.mockResolvedValue();

            await validateAudioFile(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Invalid file extension',
                message: 'File extension .txt is not supported',
                supportedExtensions: expect.arrayContaining(['.mp3', '.wav', '.flac'])
            });
            expect(fs.unlink).toHaveBeenCalledWith('/test/document.txt');
        });

        test('should handle file system errors', async () => {
            req.file = {
                path: '/test/audio.mp3',
                originalname: 'song.mp3'
            };

            fs.stat.mockRejectedValue(new Error('File system error'));
            fs.unlink.mockResolvedValue();

            await validateAudioFile(req, res, next);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'File validation failed',
                message: 'File system error'
            });
            expect(fs.unlink).toHaveBeenCalled();
        });
    });

    describe('validateProcessingOptions', () => {
        test('should pass with valid options', () => {
            req.body = {
                model: 'demucs',
                device: 'auto',
                format: 'wav'
            };

            validateProcessingOptions(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        test('should pass with no options (defaults)', () => {
            req.body = {};

            validateProcessingOptions(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        test('should reject invalid model', () => {
            req.body = {
                model: 'invalid_model'
            };

            validateProcessingOptions(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Invalid model',
                message: 'Model "invalid_model" is not supported',
                allowedModels: expect.arrayContaining(['demucs', 'openunmix'])
            });
        });

        test('should reject invalid device', () => {
            req.body = {
                device: 'quantum_computer'
            };

            validateProcessingOptions(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Invalid device',
                message: 'Device "quantum_computer" is not supported',
                allowedDevices: expect.arrayContaining(['auto', 'cpu', 'cuda'])
            });
        });

        test('should reject invalid format', () => {
            req.body = {
                format: 'midi'
            };

            validateProcessingOptions(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Invalid output format',
                message: 'Format "midi" is not supported',
                allowedFormats: expect.arrayContaining(['wav', 'flac', 'mp3'])
            });
        });
    });

    describe('validateJobId', () => {
        test('should pass with valid UUID', () => {
            req.params.jobId = '123e4567-e89b-12d3-a456-426614174000';

            validateJobId(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        test('should reject invalid UUID format', () => {
            req.params.jobId = 'not-a-uuid';

            validateJobId(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Invalid job ID',
                message: 'Job ID must be a valid UUID'
            });
        });

        test('should reject empty job ID', () => {
            req.params.jobId = '';

            validateJobId(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Invalid job ID',
                message: 'Job ID must be a valid UUID'
            });
        });

        test('should reject malformed UUID', () => {
            req.params.jobId = '123e4567-e89b-12d3-a456-42661417400g'; // 'g' at end

            validateJobId(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('validateStemName', () => {
        test('should pass with valid stem names', () => {
            const validStems = ['vocals', 'drums', 'bass', 'other', 'piano', 'guitar'];

            validStems.forEach(stem => {
                req.params.stem = stem;
                validateStemName(req, res, next);
                expect(next).toHaveBeenCalledWith();
                next.mockClear();
            });
        });

        test('should be case insensitive', () => {
            req.params.stem = 'VOCALS';

            validateStemName(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        test('should reject invalid stem name', () => {
            req.params.stem = 'theremin';

            validateStemName(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Invalid stem name',
                message: 'Stem "theremin" is not valid',
                allowedStems: expect.arrayContaining(['vocals', 'drums', 'bass', 'other'])
            });
        });

        test('should reject empty stem name', () => {
            req.params.stem = '';

            validateStemName(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('rateLimiter', () => {
        test('should allow requests within limit', () => {
            req.ip = '192.168.1.100';

            rateLimiter(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        test('should block requests exceeding limit', () => {
            req.ip = '192.168.1.101';

            // Make multiple requests to exceed limit
            for (let i = 0; i < 11; i++) {
                rateLimiter(req, res, next);
            }

            expect(res.status).toHaveBeenCalledWith(429);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Rate limit exceeded',
                message: expect.stringContaining('Maximum 10 requests'),
                retryAfter: expect.any(Number)
            });
        });

        test('should reset limit after time window', (done) => {
            req.ip = '192.168.1.102';

            // Make requests to approach limit
            for (let i = 0; i < 10; i++) {
                rateLimiter(req, res, next);
            }

            // Mock time passage (in real implementation, you'd use timers)
            // For this test, we'll assume the window resets
            setTimeout(() => {
                next.mockClear();
                rateLimiter(req, res, next);
                expect(next).toHaveBeenCalled();
                done();
            }, 10);
        });
    });

    describe('validateRequestSize', () => {
        test('should pass for requests within size limit', () => {
            req.headers['content-length'] = '1000000'; // 1MB
            process.env.MAX_FILE_SIZE = '524288000'; // 500MB

            validateRequestSize(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        test('should reject oversized requests', () => {
            req.headers['content-length'] = '600000000'; // 600MB
            process.env.MAX_FILE_SIZE = '524288000'; // 500MB

            validateRequestSize(req, res, next);

            expect(res.status).toHaveBeenCalledWith(413);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Request too large',
                message: 'Maximum request size is 500MB',
                maxSize: 524288000
            });
        });

        test('should pass when no content-length header', () => {
            req.headers = {};

            validateRequestSize(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        test('should use default max size when env var not set', () => {
            delete process.env.MAX_FILE_SIZE;
            req.headers['content-length'] = '600000000'; // 600MB

            validateRequestSize(req, res, next);

            expect(res.status).toHaveBeenCalledWith(413);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Request too large',
                message: 'Maximum request size is 500MB',
                maxSize: 500 * 1024 * 1024
            });
        });
    });
});
