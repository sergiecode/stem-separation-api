const logger = require('../../utils/logger');
const winston = require('winston');

// Mock winston
jest.mock('winston', () => ({
    createLogger: jest.fn(() => ({
        add: jest.fn(),
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        level: 'info'
    })),
    format: {
        combine: jest.fn(),
        timestamp: jest.fn(),
        errors: jest.fn(),
        json: jest.fn(),
        colorize: jest.fn(),
        printf: jest.fn()
    },
    transports: {
        File: jest.fn(),
        Console: jest.fn()
    }
}));

describe('Logger', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Logger Configuration', () => {
        test('should create logger with correct configuration', () => {
            expect(winston.createLogger).toHaveBeenCalledWith({
                level: process.env.LOG_LEVEL || 'info',
                format: expect.any(Object),
                defaultMeta: {
                    service: 'stem-separation-api',
                    author: 'Sergie Code'
                },
                transports: expect.any(Array)
            });
        });

        test('should respect LOG_LEVEL environment variable', () => {
            process.env.LOG_LEVEL = 'debug';
            
            // Re-require logger to pick up new env var
            jest.resetModules();
            require('../../utils/logger');
            
            expect(winston.createLogger).toHaveBeenCalledWith(
                expect.objectContaining({
                    level: 'debug'
                })
            );
            
            delete process.env.LOG_LEVEL;
        });

        test('should include file transports for error and combined logs', () => {
            expect(winston.transports.File).toHaveBeenCalledWith({
                filename: expect.stringContaining('error.log'),
                level: 'error',
                maxsize: 10 * 1024 * 1024,
                maxFiles: 5
            });

            expect(winston.transports.File).toHaveBeenCalledWith({
                filename: expect.stringContaining('combined.log'),
                maxsize: 10 * 1024 * 1024,
                maxFiles: 5
            });
        });

        test('should add console transport in non-production environment', () => {
            process.env.NODE_ENV = 'development';
            
            jest.resetModules();
            const mockLogger = {
                add: jest.fn(),
                info: jest.fn(),
                level: 'info'
            };
            winston.createLogger.mockReturnValue(mockLogger);
            
            require('../../utils/logger');
            
            expect(mockLogger.add).toHaveBeenCalledWith(
                expect.any(Object) // Console transport
            );
            
            delete process.env.NODE_ENV;
        });

        test('should not add console transport in production', () => {
            process.env.NODE_ENV = 'production';
            
            jest.resetModules();
            const mockLogger = {
                add: jest.fn(),
                info: jest.fn(),
                level: 'info'
            };
            winston.createLogger.mockReturnValue(mockLogger);
            
            require('../../utils/logger');
            
            expect(mockLogger.add).not.toHaveBeenCalled();
            
            delete process.env.NODE_ENV;
        });
    });

    describe('Custom Logging Methods', () => {
        let mockLogger;

        beforeEach(() => {
            mockLogger = {
                info: jest.fn(),
                warn: jest.fn(),
                level: 'info'
            };
            winston.createLogger.mockReturnValue(mockLogger);
            
            jest.resetModules();
        });

        test('should provide request logging method', () => {
            const logger = require('../../utils/logger');
            
            const mockReq = {
                ip: '192.168.1.1',
                get: jest.fn().mockReturnValue('Mozilla/5.0'),
                method: 'POST',
                originalUrl: '/api/audio/separate'
            };

            logger.request(mockReq, 'Test request');

            expect(mockLogger.info).toHaveBeenCalledWith('Test request', {
                ip: '192.168.1.1',
                userAgent: 'Mozilla/5.0',
                method: 'POST',
                url: '/api/audio/separate'
            });
        });

        test('should provide security logging method', () => {
            const logger = require('../../utils/logger');
            
            logger.security('Suspicious activity detected', { 
                ip: '10.0.0.1',
                attempt: 'brute_force'
            });

            expect(mockLogger.warn).toHaveBeenCalledWith('Suspicious activity detected', {
                type: 'security',
                ip: '10.0.0.1',
                attempt: 'brute_force'
            });
        });

        test('should provide performance logging method', () => {
            const logger = require('../../utils/logger');
            
            logger.performance('API response time', 1500, {
                endpoint: '/api/audio/separate',
                method: 'POST'
            });

            expect(mockLogger.info).toHaveBeenCalledWith('API response time', {
                type: 'performance',
                duration: '1500ms',
                endpoint: '/api/audio/separate',
                method: 'POST'
            });
        });

        test('should provide API usage logging method', () => {
            const logger = require('../../utils/logger');
            
            logger.apiUsage('/api/audio/separate', 200, 2500, {
                model: 'demucs',
                fileSize: '10MB'
            });

            expect(mockLogger.info).toHaveBeenCalledWith('API usage', {
                type: 'api-usage',
                endpoint: '/api/audio/separate',
                statusCode: 200,
                duration: '2500ms',
                model: 'demucs',
                fileSize: '10MB'
            });
        });
    });

    describe('Stream Interface', () => {
        test('should provide stream interface for Morgan', () => {
            const logger = require('../../utils/logger');
            
            expect(logger.stream).toBeDefined();
            expect(typeof logger.stream.write).toBe('function');
        });

        test('should log HTTP requests through stream', () => {
            const mockLogger = {
                info: jest.fn(),
                level: 'info'
            };
            winston.createLogger.mockReturnValue(mockLogger);
            
            jest.resetModules();
            const logger = require('../../utils/logger');
            
            logger.stream.write('GET /api/audio/models 200 - 15ms\n');
            
            expect(mockLogger.info).toHaveBeenCalledWith('GET /api/audio/models 200 - 15ms');
        });

        test('should trim messages from stream', () => {
            const mockLogger = {
                info: jest.fn(),
                level: 'info'
            };
            winston.createLogger.mockReturnValue(mockLogger);
            
            jest.resetModules();
            const logger = require('../../utils/logger');
            
            logger.stream.write('   Message with spaces   \n');
            
            expect(mockLogger.info).toHaveBeenCalledWith('Message with spaces');
        });
    });

    describe('Log Directory Creation', () => {
        test('should create logs directory if it does not exist', () => {
            const fs = require('fs');
            
            jest.spyOn(fs, 'existsSync').mockReturnValue(false);
            const mkdirSyncSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation();

            jest.resetModules();
            require('../../utils/logger');

            expect(mkdirSyncSpy).toHaveBeenCalledWith(
                expect.stringContaining('logs'),
                { recursive: true }
            );

            fs.existsSync.mockRestore();
            fs.mkdirSync.mockRestore();
        });

        test('should not create directory if it already exists', () => {
            const fs = require('fs');
            
            jest.spyOn(fs, 'existsSync').mockReturnValue(true);
            const mkdirSyncSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation();

            jest.resetModules();
            require('../../utils/logger');

            expect(mkdirSyncSpy).not.toHaveBeenCalled();

            fs.existsSync.mockRestore();
            fs.mkdirSync.mockRestore();
        });
    });

    describe('Startup Logging', () => {
        test('should log startup information in non-test environment', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';

            const mockLogger = {
                info: jest.fn(),
                level: 'info'
            };
            winston.createLogger.mockReturnValue(mockLogger);

            jest.resetModules();
            require('../../utils/logger');

            expect(mockLogger.info).toHaveBeenCalledWith(
                '🚀 Stem Separation API Logger initialized',
                expect.objectContaining({
                    logLevel: 'info',
                    environment: 'development',
                    logDirectory: expect.any(String)
                })
            );

            process.env.NODE_ENV = originalEnv;
        });

        test('should not log startup information in test environment', () => {
            process.env.NODE_ENV = 'test';

            const mockLogger = {
                info: jest.fn(),
                level: 'info'
            };
            winston.createLogger.mockReturnValue(mockLogger);

            jest.resetModules();
            require('../../utils/logger');

            // Should not call info for startup message
            expect(mockLogger.info).not.toHaveBeenCalledWith(
                expect.stringContaining('Stem Separation API Logger initialized'),
                expect.any(Object)
            );
        });
    });

    describe('Error Handling', () => {
        test('should handle logging errors gracefully', () => {
            const mockLogger = {
                info: jest.fn().mockImplementation(() => {
                    throw new Error('Logging failed');
                }),
                level: 'info'
            };
            winston.createLogger.mockReturnValue(mockLogger);

            jest.resetModules();
            const logger = require('../../utils/logger');

            // Should not throw when logging fails
            expect(() => {
                logger.info('Test message');
            }).not.toThrow();
        });
    });
});
