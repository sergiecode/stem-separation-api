const StemSeparatorService = require('../../services/stemSeparatorService');
const fs = require('fs').promises;
const path = require('path');

// Mock child_process
jest.mock('child_process');
const { exec } = require('child_process');

describe('StemSeparatorService', () => {
    let service;
    
    beforeEach(() => {
        service = new StemSeparatorService();
        jest.clearAllMocks();
    });

    describe('Constructor', () => {
        test('should initialize with default configuration', () => {
            expect(service.config).toBeDefined();
            expect(service.config.pythonPath).toBe(process.env.PYTHON_PATH || 'python');
            expect(service.config.defaultModel).toBe(process.env.DEFAULT_MODEL || 'demucs');
            expect(service.config.timeout).toBe(parseInt(process.env.PROCESSING_TIMEOUT) || 300000);
        });

        test('should use environment variables when provided', () => {
            process.env.PYTHON_PATH = 'python3';
            process.env.DEFAULT_MODEL = 'openunmix';
            process.env.PROCESSING_TIMEOUT = '600000';
            
            const customService = new StemSeparatorService();
            
            expect(customService.config.pythonPath).toBe('python3');
            expect(customService.config.defaultModel).toBe('openunmix');
            expect(customService.config.timeout).toBe(600000);
        });
    });

    describe('healthCheck', () => {
        test('should return available when all checks pass', async () => {
            // Mock successful Python version check
            exec.mockImplementation((command, options, callback) => {
                if (command.includes('--version')) {
                    callback(null, { stdout: 'Python 3.9.0' });
                } else if (command.includes('--help')) {
                    callback(null, { stdout: 'Audio Stem Separator Help' });
                }
            });

            // Mock file system access
            jest.spyOn(fs, 'access').mockResolvedValue(true);

            const result = await service.healthCheck();
            
            expect(result.available).toBe(true);
            expect(result.message).toBe('Service is ready');
            expect(result.pythonVersion).toContain('Python 3.9.0');
        });

        test('should return unavailable when Python is not found', async () => {
            exec.mockImplementation((command, options, callback) => {
                callback(new Error('Python not found'));
            });

            const result = await service.healthCheck();
            
            expect(result.available).toBe(false);
            expect(result.message).toContain('Service unavailable');
            expect(result.suggestions).toBeDefined();
            expect(Array.isArray(result.suggestions)).toBe(true);
        });

        test('should return unavailable when project directory is missing', async () => {
            exec.mockImplementation((command, options, callback) => {
                if (command.includes('--version')) {
                    callback(null, { stdout: 'Python 3.9.0' });
                }
            });

            jest.spyOn(fs, 'access').mockRejectedValue(new Error('Directory not found'));

            const result = await service.healthCheck();
            
            expect(result.available).toBe(false);
        });
    });

    describe('getAvailableModels', () => {
        test('should return models from Python backend when available', async () => {
            const mockModels = [
                {
                    name: 'demucs',
                    description: 'Demucs v4 - High quality separation',
                    stems: ['vocals', 'drums', 'bass', 'other'],
                    default: true
                }
            ];

            exec.mockImplementation((command, options, callback) => {
                callback(null, { 
                    stdout: JSON.stringify({ 
                        success: true, 
                        models: mockModels 
                    }) 
                });
            });

            const result = await service.getAvailableModels();
            
            expect(result).toEqual(mockModels);
        });

        test('should return default models when Python backend fails', async () => {
            exec.mockImplementation((command, options, callback) => {
                callback(new Error('Backend not available'));
            });

            const result = await service.getAvailableModels();
            
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
            expect(result[0]).toHaveProperty('name');
            expect(result[0]).toHaveProperty('description');
            expect(result[0]).toHaveProperty('stems');
        });

        test('should handle malformed JSON response', async () => {
            exec.mockImplementation((command, options, callback) => {
                callback(null, { stdout: 'Invalid JSON' });
            });

            const result = await service.getAvailableModels();
            
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
        });
    });

    describe('separateStems', () => {
        const mockInputFile = '/test/input.mp3';
        const mockOutputDir = '/test/output';
        const mockOptions = {
            model: 'demucs',
            device: 'auto',
            format: 'wav'
        };

        beforeEach(() => {
            // Mock file system operations
            jest.spyOn(fs, 'access').mockResolvedValue(true);
            jest.spyOn(fs, 'stat').mockResolvedValue({ size: 1024 * 1024 }); // 1MB
            jest.spyOn(fs, 'mkdir').mockResolvedValue(true);
        });

        test('should process audio successfully', async () => {
            const mockResult = {
                success: true,
                stems: ['vocals', 'drums', 'bass', 'other'],
                processing_time: 120.5,
                model_used: 'demucs',
                device_used: 'cuda'
            };

            exec.mockImplementation((command, options, callback) => {
                callback(null, { stdout: JSON.stringify(mockResult) });
            });

            jest.spyOn(service, 'getOutputFiles').mockResolvedValue({
                vocals: { path: '/test/vocals.wav', exists: true },
                drums: { path: '/test/drums.wav', exists: true }
            });

            const result = await service.separateStems(mockInputFile, mockOutputDir, mockOptions);
            
            expect(result.success).toBe(true);
            expect(result.processing_time).toBe(120.5);
            expect(result.files).toBeDefined();
            expect(result.downloadUrls).toBeDefined();
        });

        test('should handle input file not found', async () => {
            jest.spyOn(fs, 'access').mockRejectedValue(new Error('File not found'));

            await expect(service.separateStems(mockInputFile, mockOutputDir, mockOptions))
                .rejects.toThrow('Input file not found');
        });

        test('should handle processing timeout', async () => {
            exec.mockImplementation((command, options, callback) => {
                const error = new Error('Timeout');
                error.code = 'TIMEOUT';
                callback(error);
            });

            await expect(service.separateStems(mockInputFile, mockOutputDir, mockOptions))
                .rejects.toThrow('Audio processing timed out');
        });

        test('should handle Python script errors', async () => {
            const mockError = {
                success: false,
                error: 'Model not found'
            };

            exec.mockImplementation((command, options, callback) => {
                callback(null, { stdout: JSON.stringify(mockError) });
            });

            const result = await service.separateStems(mockInputFile, mockOutputDir, mockOptions);
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Model not found');
        });

        test('should call progress callback when provided', async () => {
            const mockResult = {
                success: true,
                stems: ['vocals', 'drums'],
                processing_time: 60
            };

            exec.mockImplementation((command, options, callback) => {
                callback(null, { stdout: JSON.stringify(mockResult) });
            });

            jest.spyOn(service, 'getOutputFiles').mockResolvedValue({});

            const progressCallback = jest.fn();
            
            await service.separateStems(mockInputFile, mockOutputDir, mockOptions, progressCallback);
            
            expect(progressCallback).toHaveBeenCalledWith(10, 'Loading AI model...');
            expect(progressCallback).toHaveBeenCalledWith(90, 'Finalizing stems...');
            expect(progressCallback).toHaveBeenCalledWith(100, 'Stem separation completed successfully!');
        });
    });

    describe('getOutputFiles', () => {
        const mockOutputDir = '/test/output';
        const mockStems = ['vocals', 'drums', 'bass'];

        test('should find existing output files', async () => {
            jest.spyOn(fs, 'stat').mockResolvedValue({ size: 2048 });

            const result = await service.getOutputFiles(mockOutputDir, mockStems);
            
            expect(result).toHaveProperty('vocals');
            expect(result).toHaveProperty('drums');
            expect(result).toHaveProperty('bass');
            
            expect(result.vocals.exists).toBe(true);
            expect(result.vocals.size).toBe(2048);
            expect(result.vocals.format).toBe('wav');
        });

        test('should handle missing output files', async () => {
            jest.spyOn(fs, 'stat').mockRejectedValue(new Error('File not found'));

            const result = await service.getOutputFiles(mockOutputDir, mockStems);
            
            expect(result.vocals.exists).toBe(false);
            expect(result.vocals.path).toBeNull();
            expect(result.vocals.url).toBeNull();
        });

        test('should try multiple file extensions', async () => {
            jest.spyOn(fs, 'stat')
                .mockRejectedValueOnce(new Error('wav not found'))
                .mockRejectedValueOnce(new Error('flac not found'))
                .mockResolvedValueOnce({ size: 1024 }); // mp3 found

            const result = await service.getOutputFiles(mockOutputDir, ['vocals']);
            
            expect(result.vocals.exists).toBe(true);
            expect(result.vocals.format).toBe('mp3');
        });
    });

    describe('getServiceInfo', () => {
        test('should return comprehensive service information', async () => {
            jest.spyOn(service, 'healthCheck').mockResolvedValue({
                available: true,
                message: 'Service is ready'
            });

            const result = await service.getServiceInfo();
            
            expect(result).toHaveProperty('service', 'Stem Separator Service');
            expect(result).toHaveProperty('version', '1.0.0');
            expect(result).toHaveProperty('author', 'Sergie Code');
            expect(result).toHaveProperty('status', 'available');
            expect(result).toHaveProperty('config');
            expect(result).toHaveProperty('health');
        });
    });
});
