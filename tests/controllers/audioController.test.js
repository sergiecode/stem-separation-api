const audioController = require('../../controllers/audioController');
const StemSeparatorService = require('../../services/stemSeparatorService');
const { v4: uuidv4 } = require('uuid');

// Mock dependencies
jest.mock('../../services/stemSeparatorService');
jest.mock('uuid');
jest.mock('fs/promises');

const fs = require('fs').promises;

describe('AudioController', () => {
    let req, res, mockService;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Mock StemSeparatorService
        mockService = {
            separateStems: jest.fn(),
            getAvailableModels: jest.fn(),
            healthCheck: jest.fn()
        };
        StemSeparatorService.mockImplementation(() => mockService);

        // Mock request and response objects
        req = {
            file: null,
            body: {},
            params: {},
            query: {},
            app: {
                get: jest.fn().mockReturnValue({
                    to: jest.fn().mockReturnValue({
                        emit: jest.fn()
                    })
                })
            }
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            download: jest.fn(),
            setHeader: jest.fn()
        };

        // Mock UUID generation
        uuidv4.mockReturnValue('test-job-id-123');
    });

    describe('separateStems', () => {
        test('should return error when no file is provided', async () => {
            req.file = null;

            await audioController.separateStems(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'No audio file provided',
                message: 'Please upload an audio file using the "audio" field'
            });
        });

        test('should start processing when valid file is provided', async () => {
            req.file = {
                path: '/test/input.mp3',
                originalname: 'song.mp3',
                size: 1024 * 1024
            };
            req.body = {
                model: 'demucs',
                device: 'auto',
                format: 'wav'
            };

            await audioController.separateStems(req, res);

            expect(res.status).toHaveBeenCalledWith(202);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                jobId: 'test-job-id-123',
                message: 'Processing started',
                estimatedTime: expect.any(Number),
                statusUrl: '/api/audio/status/test-job-id-123',
                websocketEvent: 'job-test-job-id-123',
                downloadUrlPattern: '/api/audio/download/test-job-id-123/{stem}'
            });
        });

        test('should use default values when options not provided', async () => {
            req.file = {
                path: '/test/input.mp3',
                originalname: 'song.mp3',
                size: 1024 * 1024
            };
            req.body = {}; // No options provided

            await audioController.separateStems(req, res);

            expect(res.status).toHaveBeenCalledWith(202);
            const responseCall = res.json.mock.calls[0][0];
            expect(responseCall.success).toBe(true);
            expect(responseCall.jobId).toBe('test-job-id-123');
        });

        test('should handle processing errors gracefully', async () => {
            req.file = {
                path: '/test/input.mp3',
                originalname: 'song.mp3',
                size: 1024 * 1024
            };

            // Mock file cleanup
            fs.unlink = jest.fn().mockResolvedValue();

            // Mock error during processing
            const error = new Error('Processing failed');
            audioController.processAudioAsync = jest.fn().mockRejectedValue(error);

            await audioController.separateStems(req, res);

            expect(res.status).toHaveBeenCalledWith(202);
        });
    });

    describe('getStatus', () => {
        test('should return job status when job exists', async () => {
            req.params.jobId = 'test-job-id';
            
            // Mock job storage (simulate existing job)
            const mockJob = {
                id: 'test-job-id',
                status: 'processing',
                progress: 50,
                inputFile: 'song.mp3',
                inputSize: 1024 * 1024,
                model: 'demucs',
                device: 'auto',
                startTime: new Date(),
                estimatedTime: 120
            };

            // Access the internal jobs Map (would need to be exposed or use dependency injection)
            audioController.jobs = new Map();
            audioController.jobs.set('test-job-id', mockJob);

            await audioController.getStatus(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                job: expect.objectContaining({
                    id: 'test-job-id',
                    status: 'processing',
                    progress: 50
                })
            });
        });

        test('should return 404 when job not found', async () => {
            req.params.jobId = 'non-existent-job';
            
            audioController.jobs = new Map();

            await audioController.getStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Job not found',
                message: 'No job found with ID: non-existent-job'
            });
        });

        test('should include download URLs for completed jobs', async () => {
            req.params.jobId = 'completed-job-id';
            
            const mockCompletedJob = {
                id: 'completed-job-id',
                status: 'completed',
                progress: 100,
                inputFile: 'song.mp3',
                model: 'demucs',
                result: {
                    files: {
                        vocals: { exists: true },
                        drums: { exists: true }
                    }
                }
            };

            audioController.jobs = new Map();
            audioController.jobs.set('completed-job-id', mockCompletedJob);

            await audioController.getStatus(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                job: expect.objectContaining({
                    status: 'completed',
                    downloadUrls: {
                        vocals: '/api/audio/download/completed-job-id/vocals',
                        drums: '/api/audio/download/completed-job-id/drums'
                    }
                })
            });
        });
    });

    describe('getModels', () => {
        test('should return available models', async () => {
            const mockModels = [
                {
                    name: 'demucs',
                    description: 'High quality separation',
                    default: true
                }
            ];

            mockService.getAvailableModels.mockResolvedValue(mockModels);

            await audioController.getModels(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                models: mockModels,
                defaultModel: process.env.DEFAULT_MODEL || 'demucs',
                supportedDevices: ['auto', 'cpu', 'cuda'],
                supportedFormats: ['wav', 'flac', 'mp3']
            });
        });

        test('should handle service errors', async () => {
            mockService.getAvailableModels.mockRejectedValue(new Error('Service unavailable'));

            await audioController.getModels(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Failed to get available models',
                message: 'Service unavailable'
            });
        });
    });

    describe('downloadStem', () => {
        beforeEach(() => {
            req.params = {
                jobId: 'test-job-id',
                stem: 'vocals'
            };

            fs.access = jest.fn().mockResolvedValue();
        });

        test('should download stem for completed job', async () => {
            const mockJob = {
                id: 'test-job-id',
                status: 'completed',
                inputFile: 'song.mp3'
            };

            audioController.jobs = new Map();
            audioController.jobs.set('test-job-id', mockJob);

            await audioController.downloadStem(req, res);

            expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'audio/wav');
            expect(res.setHeader).toHaveBeenCalledWith(
                'Content-Disposition', 
                'attachment; filename="vocals_song.wav"'
            );
            expect(res.download).toHaveBeenCalled();
        });

        test('should return 404 for non-existent job', async () => {
            audioController.jobs = new Map();

            await audioController.downloadStem(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Job not found'
            });
        });

        test('should return error for incomplete job', async () => {
            const mockJob = {
                id: 'test-job-id',
                status: 'processing'
            };

            audioController.jobs = new Map();
            audioController.jobs.set('test-job-id', mockJob);

            await audioController.downloadStem(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Job not completed',
                status: 'processing',
                message: 'Stem separation is not yet completed'
            });
        });

        test('should return 404 when stem file not found', async () => {
            const mockJob = {
                id: 'test-job-id',
                status: 'completed',
                inputFile: 'song.mp3'
            };

            audioController.jobs = new Map();
            audioController.jobs.set('test-job-id', mockJob);

            fs.access.mockRejectedValue(new Error('File not found'));

            await audioController.downloadStem(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Stem file not found',
                message: 'The vocals stem file could not be found'
            });
        });
    });

    describe('cancelJob', () => {
        test('should cancel pending job', async () => {
            req.params.jobId = 'test-job-id';
            
            const mockJob = {
                id: 'test-job-id',
                status: 'processing'
            };

            audioController.jobs = new Map();
            audioController.jobs.set('test-job-id', mockJob);

            fs.rmdir = jest.fn().mockResolvedValue();

            await audioController.cancelJob(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: 'Job cancelled successfully'
            });
        });

        test('should not cancel completed job', async () => {
            req.params.jobId = 'test-job-id';
            
            const mockJob = {
                id: 'test-job-id',
                status: 'completed'
            };

            audioController.jobs = new Map();
            audioController.jobs.set('test-job-id', mockJob);

            await audioController.cancelJob(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Cannot cancel completed job'
            });
        });
    });

    describe('getRecentJobs', () => {
        test('should return list of recent jobs', async () => {
            req.query = { limit: '10' };

            const mockJobs = new Map();
            mockJobs.set('job1', {
                id: 'job1',
                status: 'completed',
                inputFile: 'song1.mp3',
                model: 'demucs',
                startTime: new Date('2024-01-01'),
                processingTime: 120
            });
            mockJobs.set('job2', {
                id: 'job2',
                status: 'processing',
                inputFile: 'song2.mp3',
                model: 'openunmix',
                startTime: new Date('2024-01-02')
            });

            audioController.jobs = mockJobs;

            await audioController.getRecentJobs(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                jobs: expect.arrayContaining([
                    expect.objectContaining({
                        id: 'job2',
                        status: 'processing'
                    }),
                    expect.objectContaining({
                        id: 'job1',
                        status: 'completed'
                    })
                ]),
                total: 2
            });
        });

        test('should limit results when limit parameter provided', async () => {
            req.query = { limit: '1' };

            const mockJobs = new Map();
            mockJobs.set('job1', { id: 'job1', startTime: new Date('2024-01-01') });
            mockJobs.set('job2', { id: 'job2', startTime: new Date('2024-01-02') });

            audioController.jobs = mockJobs;

            await audioController.getRecentJobs(req, res);

            const response = res.json.mock.calls[0][0];
            expect(response.jobs).toHaveLength(1);
            expect(response.jobs[0].id).toBe('job2'); // Most recent
        });
    });

    describe('estimateProcessingTime', () => {
        test('should estimate time based on file size and model', () => {
            const fileSize = 10 * 1024 * 1024; // 10MB
            
            const demucsTime = audioController.estimateProcessingTime(fileSize, 'demucs');
            const openunmixTime = audioController.estimateProcessingTime(fileSize, 'openunmix');
            
            expect(demucsTime).toBe(80); // 10MB * 8s/MB
            expect(openunmixTime).toBe(40); // 10MB * 4s/MB
            expect(demucsTime).toBeGreaterThan(openunmixTime);
        });
    });
});
