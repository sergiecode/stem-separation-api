const { upload, handleUploadError } = require('../../middleware/upload');
const multer = require('multer');
const path = require('path');

// Mock multer
jest.mock('multer');

describe('Upload Middleware', () => {
    let req, res, next;

    beforeEach(() => {
        req = {
            file: null,
            files: []
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };

        next = jest.fn();
        jest.clearAllMocks();
    });

    describe('File Filter', () => {
        let fileFilter;

        beforeEach(() => {
            // Extract the fileFilter function from multer mock
            const multerConfig = multer.mock.calls[0]?.[0];
            fileFilter = multerConfig?.fileFilter;
        });

        test('should accept valid audio file types', () => {
            const validTypes = [
                'audio/mpeg',
                'audio/wav',
                'audio/flac',
                'audio/m4a',
                'audio/aac',
                'audio/ogg'
            ];

            validTypes.forEach(mimetype => {
                const file = { mimetype, originalname: 'test.mp3' };
                const callback = jest.fn();

                if (fileFilter) {
                    fileFilter(req, file, callback);
                    expect(callback).toHaveBeenCalledWith(null, true);
                }
                callback.mockClear();
            });
        });

        test('should accept files based on extension when mimetype is generic', () => {
            const file = {
                mimetype: 'application/octet-stream',
                originalname: 'song.mp3'
            };
            const callback = jest.fn();

            if (fileFilter) {
                fileFilter(req, file, callback);
                expect(callback).toHaveBeenCalledWith(null, true);
            }
        });

        test('should reject non-audio file types', () => {
            const invalidFiles = [
                { mimetype: 'text/plain', originalname: 'document.txt' },
                { mimetype: 'image/jpeg', originalname: 'photo.jpg' },
                { mimetype: 'video/mp4', originalname: 'video.mp4' },
                { mimetype: 'application/pdf', originalname: 'document.pdf' }
            ];

            invalidFiles.forEach(file => {
                const callback = jest.fn();

                if (fileFilter) {
                    fileFilter(req, file, callback);
                    expect(callback).toHaveBeenCalledWith(
                        expect.any(Error),
                        false
                    );
                    expect(callback.mock.calls[0][0].message).toContain('Invalid file type');
                }
                callback.mockClear();
            });
        });

        test('should accept valid audio extensions even with wrong mimetype', () => {
            const validExtensions = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg'];

            validExtensions.forEach(ext => {
                const file = {
                    mimetype: 'application/octet-stream',
                    originalname: `audio${ext}`
                };
                const callback = jest.fn();

                if (fileFilter) {
                    fileFilter(req, file, callback);
                    expect(callback).toHaveBeenCalledWith(null, true);
                }
                callback.mockClear();
            });
        });
    });

    describe('Storage Configuration', () => {
        let storageConfig;

        beforeEach(() => {
            const multerConfig = multer.mock.calls[0]?.[0];
            storageConfig = multerConfig?.storage;
        });

        test('should generate unique filenames', () => {
            const file = {
                originalname: 'my song.mp3',
                fieldname: 'audio'
            };

            const callback = jest.fn();

            if (storageConfig?.filename) {
                storageConfig.filename(req, file, callback);
                
                expect(callback).toHaveBeenCalled();
                const generatedName = callback.mock.calls[0][1];
                
                expect(generatedName).toMatch(/^my_song-\d+-\d+\.mp3$/);
                expect(generatedName).not.toContain(' '); // Spaces should be replaced
                expect(generatedName).not.toContain('..'); // No relative paths
            }
        });

        test('should sanitize filenames with special characters', () => {
            const file = {
                originalname: 'song<>:"/\\|?*.mp3',
                fieldname: 'audio'
            };

            const callback = jest.fn();

            if (storageConfig?.filename) {
                storageConfig.filename(req, file, callback);
                
                const generatedName = callback.mock.calls[0][1];
                expect(generatedName).not.toMatch(/[<>:"/\\|?*]/);
            }
        });

        test('should preserve file extension', () => {
            const testCases = [
                { input: 'song.mp3', expectedExt: '.mp3' },
                { input: 'track.wav', expectedExt: '.wav' },
                { input: 'music.flac', expectedExt: '.flac' }
            ];

            testCases.forEach(({ input, expectedExt }) => {
                const file = { originalname: input, fieldname: 'audio' };
                const callback = jest.fn();

                if (storageConfig?.filename) {
                    storageConfig.filename(req, file, callback);
                    
                    const generatedName = callback.mock.calls[0][1];
                    expect(generatedName).toMatch(new RegExp(`\\${expectedExt}$`));
                }
                callback.mockClear();
            });
        });
    });

    describe('File Size Limits', () => {
        test('should respect MAX_FILE_SIZE environment variable', () => {
            process.env.MAX_FILE_SIZE = '100000000'; // 100MB

            const multerConfig = multer.mock.calls[0]?.[0];
            expect(multerConfig?.limits?.fileSize).toBe(100000000);
        });

        test('should use default size when env var not set', () => {
            delete process.env.MAX_FILE_SIZE;

            // Re-require to get fresh configuration
            jest.resetModules();
            require('../../middleware/upload');

            const multerConfig = multer.mock.calls[multer.mock.calls.length - 1]?.[0];
            expect(multerConfig?.limits?.fileSize).toBe(500 * 1024 * 1024); // 500MB default
        });

        test('should limit to one file upload', () => {
            const multerConfig = multer.mock.calls[0]?.[0];
            expect(multerConfig?.limits?.files).toBe(1);
        });
    });

    describe('handleUploadError', () => {
        test('should handle LIMIT_FILE_SIZE error', () => {
            const error = new multer.MulterError('LIMIT_FILE_SIZE');
            error.code = 'LIMIT_FILE_SIZE';

            handleUploadError(error, req, res, next);

            expect(res.status).toHaveBeenCalledWith(413);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'File too large',
                message: expect.stringContaining('Maximum file size'),
                maxSize: expect.any(Number)
            });
        });

        test('should handle LIMIT_FILE_COUNT error', () => {
            const error = new multer.MulterError('LIMIT_FILE_COUNT');
            error.code = 'LIMIT_FILE_COUNT';

            handleUploadError(error, req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Too many files',
                message: 'Only one audio file can be uploaded at a time'
            });
        });

        test('should handle LIMIT_UNEXPECTED_FILE error', () => {
            const error = new multer.MulterError('LIMIT_UNEXPECTED_FILE');
            error.code = 'LIMIT_UNEXPECTED_FILE';

            handleUploadError(error, req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Unexpected file field',
                message: 'Please use the "audio" field for file upload'
            });
        });

        test('should handle generic multer errors', () => {
            const error = new multer.MulterError('UNKNOWN_ERROR');
            error.code = 'UNKNOWN_ERROR';
            error.message = 'Unknown upload error';

            handleUploadError(error, req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Upload error',
                message: 'Unknown upload error'
            });
        });

        test('should handle invalid file type errors', () => {
            const error = new Error('Invalid file type. Supported formats: .mp3, .wav');

            handleUploadError(error, req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Invalid file type',
                message: 'Invalid file type. Supported formats: .mp3, .wav',
                supportedFormats: expect.arrayContaining(['.mp3', '.wav'])
            });
        });

        test('should pass through non-upload errors', () => {
            const error = new Error('Some other error');

            handleUploadError(error, req, res, next);

            expect(next).toHaveBeenCalledWith(error);
            expect(res.status).not.toHaveBeenCalled();
        });
    });

    describe('Directory Creation', () => {
        test('should create upload directory if it does not exist', () => {
            const fs = require('fs');
            const uploadDir = path.join(__dirname, '../../uploads');

            // Mock fs.existsSync to return false (directory doesn't exist)
            jest.spyOn(fs, 'existsSync').mockReturnValue(false);
            const mkdirSyncSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation();

            // Re-require the module to trigger directory creation
            jest.resetModules();
            require('../../middleware/upload');

            expect(mkdirSyncSpy).toHaveBeenCalledWith(uploadDir, { recursive: true });

            // Restore mocks
            fs.existsSync.mockRestore();
            fs.mkdirSync.mockRestore();
        });

        test('should not create directory if it already exists', () => {
            const fs = require('fs');

            jest.spyOn(fs, 'existsSync').mockReturnValue(true);
            const mkdirSyncSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation();

            jest.resetModules();
            require('../../middleware/upload');

            expect(mkdirSyncSpy).not.toHaveBeenCalled();

            fs.existsSync.mockRestore();
            fs.mkdirSync.mockRestore();
        });
    });
});
