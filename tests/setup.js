// Global test setup
const path = require('path');

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.UPLOAD_LIMIT = '100MB';
process.env.PYTHON_SCRIPT_PATH = path.join(__dirname, '..', 'python', 'separate_stems.py');
process.env.OUTPUT_DIR = path.join(__dirname, '..', 'test-output');
process.env.UPLOAD_DIR = path.join(__dirname, '..', 'test-uploads');

// Increase timeout for tests that may take longer
jest.setTimeout(30000);

// Mock console methods in test environment to reduce noise
const originalConsole = { ...console };

beforeAll(() => {
    // Only mock console in test environment
    if (process.env.NODE_ENV === 'test') {
        console.log = jest.fn();
        console.warn = jest.fn();
        console.error = jest.fn();
        console.info = jest.fn();
    }
});

afterAll(() => {
    // Restore console methods
    if (process.env.NODE_ENV === 'test') {
        console.log = originalConsole.log;
        console.warn = originalConsole.warn;
        console.error = originalConsole.error;
        console.info = originalConsole.info;
    }
});

// Global test teardown
afterEach(() => {
    // Clear all mocks after each test
    jest.clearAllMocks();
});

// Mock fs/promises for all tests
jest.mock('fs/promises', () => ({
    access: jest.fn(),
    readdir: jest.fn(),
    unlink: jest.fn(),
    stat: jest.fn(),
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn()
}));

// Mock child_process for all tests
jest.mock('child_process', () => ({
    spawn: jest.fn()
}));

// Global error handler for unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit in test environment, just log the error
});

// Global error handler for uncaught exceptions in tests
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Don't exit in test environment, just log the error
});
