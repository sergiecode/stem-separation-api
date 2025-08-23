const StemSeparatorService = require('../services/stemSeparatorService');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

// In-memory job storage (consider using Redis for production with multiple instances)
const jobs = new Map();

class AudioController {
    constructor() {
        this.stemService = new StemSeparatorService();
        
        // Cleanup old jobs every hour
        setInterval(() => this.cleanupOldJobs(), 60 * 60 * 1000);
    }

    /**
     * Separate audio stems
     */
    async separateStems(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No audio file provided',
                    message: 'Please upload an audio file using the "audio" field'
                });
            }

            const jobId = uuidv4();
            const { 
                model = process.env.DEFAULT_MODEL || 'demucs', 
                device = 'auto',
                format = 'wav'
            } = req.body;
            
            const inputFile = req.file.path;
            const outputDir = path.join(__dirname, '..', process.env.OUTPUT_DIR || 'outputs', jobId);

            // Store job info
            const jobData = {
                id: jobId,
                status: 'queued',
                inputFile: req.file.originalname,
                inputSize: req.file.size,
                model,
                device,
                format,
                startTime: new Date(),
                progress: 0,
                estimatedTime: this.estimateProcessingTime(req.file.size, model)
            };

            jobs.set(jobId, jobData);

            logger.info(`🎵 New job created: ${jobId} - ${req.file.originalname} (${Math.round(req.file.size / 1024 / 1024)}MB)`);

            // Start processing asynchronously
            this.processAudioAsync(jobId, inputFile, outputDir, { model, device, format })
                .catch(error => {
                    logger.error(`Job ${jobId} failed:`, error);
                    jobs.set(jobId, {
                        ...jobs.get(jobId),
                        status: 'failed',
                        error: error.message,
                        endTime: new Date()
                    });

                    // Emit error via WebSocket
                    const io = req.app.get('io');
                    io?.to(`job-${jobId}`).emit('job-update', {
                        jobId,
                        status: 'failed',
                        error: error.message,
                        endTime: new Date()
                    });
                });

            res.status(202).json({
                success: true,
                jobId,
                message: 'Processing started',
                estimatedTime: jobData.estimatedTime,
                statusUrl: `/api/audio/status/${jobId}`,
                websocketEvent: `job-${jobId}`,
                downloadUrlPattern: `/api/audio/download/${jobId}/{stem}`
            });

        } catch (error) {
            logger.error('Error in separateStems:', error);
            
            // Cleanup uploaded file on error
            if (req.file) {
                await fs.unlink(req.file.path).catch(() => {});
            }

            res.status(500).json({
                success: false,
                error: 'Processing failed',
                message: error.message
            });
        }
    }

    /**
     * Process audio asynchronously
     */
    async processAudioAsync(jobId, inputFile, outputDir, options) {
        const io = require('../index').app?.get('io');
        
        try {
            // Update job status to processing
            jobs.set(jobId, {
                ...jobs.get(jobId),
                status: 'processing',
                progress: 5
            });

            // Emit processing started
            io?.to(`job-${jobId}`).emit('job-update', {
                jobId,
                status: 'processing',
                progress: 5,
                message: 'Initializing audio separation...'
            });

            logger.info(`🔄 Processing job ${jobId} with model ${options.model}`);

            // Emit progress updates
            const progressCallback = (progress, message) => {
                jobs.set(jobId, {
                    ...jobs.get(jobId),
                    progress
                });

                io?.to(`job-${jobId}`).emit('job-update', {
                    jobId,
                    status: 'processing',
                    progress,
                    message
                });
            };

            const result = await this.stemService.separateStems(
                inputFile, 
                outputDir, 
                options,
                progressCallback
            );
            
            if (result.success) {
                const completedJob = {
                    ...jobs.get(jobId),
                    status: 'completed',
                    result,
                    endTime: new Date(),
                    progress: 100,
                    processingTime: result.processing_time
                };

                jobs.set(jobId, completedJob);

                logger.info(`✅ Job ${jobId} completed in ${result.processing_time}s`);

                // Emit completion
                io?.to(`job-${jobId}`).emit('job-update', {
                    jobId,
                    status: 'completed',
                    progress: 100,
                    message: 'Separation completed successfully!',
                    result,
                    processingTime: result.processing_time
                });
            } else {
                jobs.set(jobId, {
                    ...jobs.get(jobId),
                    status: 'failed',
                    error: result.error,
                    endTime: new Date()
                });

                logger.error(`❌ Job ${jobId} failed: ${result.error}`);
            }

        } catch (error) {
            logger.error(`💥 Job ${jobId} crashed:`, error);
            
            jobs.set(jobId, {
                ...jobs.get(jobId),
                status: 'failed',
                error: error.message,
                endTime: new Date()
            });

            // Emit error
            io?.to(`job-${jobId}`).emit('job-update', {
                jobId,
                status: 'failed',
                error: error.message,
                endTime: new Date()
            });

            throw error;
        } finally {
            // Cleanup input file
            try {
                await fs.unlink(inputFile);
                logger.info(`🗑️ Cleaned up input file for job ${jobId}`);
            } catch (cleanupError) {
                logger.warn(`Failed to cleanup input file for job ${jobId}:`, cleanupError.message);
            }
        }
    }

    /**
     * Get job status
     */
    async getStatus(req, res) {
        try {
            const { jobId } = req.params;
            const job = jobs.get(jobId);

            if (!job) {
                return res.status(404).json({
                    success: false,
                    error: 'Job not found',
                    message: `No job found with ID: ${jobId}`
                });
            }

            const responseData = {
                success: true,
                job: {
                    id: job.id,
                    status: job.status,
                    progress: job.progress,
                    inputFile: job.inputFile,
                    inputSize: job.inputSize,
                    model: job.model,
                    device: job.device,
                    startTime: job.startTime,
                    endTime: job.endTime,
                    estimatedTime: job.estimatedTime,
                    processingTime: job.processingTime,
                    error: job.error
                }
            };

            // Include result and download URLs if completed
            if (job.status === 'completed' && job.result) {
                responseData.job.result = job.result;
                responseData.job.downloadUrls = {};
                
                if (job.result.files) {
                    Object.keys(job.result.files).forEach(stem => {
                        if (job.result.files[stem].exists) {
                            responseData.job.downloadUrls[stem] = `/api/audio/download/${jobId}/${stem}`;
                        }
                    });
                }
            }

            res.json(responseData);

        } catch (error) {
            logger.error('Error getting job status:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get job status',
                message: error.message
            });
        }
    }

    /**
     * Get available models
     */
    async getModels(req, res) {
        try {
            const models = await this.stemService.getAvailableModels();
            
            res.json({
                success: true,
                models,
                defaultModel: process.env.DEFAULT_MODEL || 'demucs',
                supportedDevices: ['auto', 'cpu', 'cuda'],
                supportedFormats: ['wav', 'flac', 'mp3']
            });
        } catch (error) {
            logger.error('Error getting models:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get available models',
                message: error.message
            });
        }
    }

    /**
     * Download separated stem
     */
    async downloadStem(req, res) {
        try {
            const { jobId, stem } = req.params;
            const job = jobs.get(jobId);

            if (!job) {
                return res.status(404).json({
                    success: false,
                    error: 'Job not found'
                });
            }

            if (job.status !== 'completed') {
                return res.status(400).json({
                    success: false,
                    error: 'Job not completed',
                    status: job.status,
                    message: 'Stem separation is not yet completed'
                });
            }

            const stemFile = path.join(__dirname, '..', process.env.OUTPUT_DIR || 'outputs', jobId, `${stem}.wav`);
            
            try {
                await fs.access(stemFile);
                
                // Set proper headers for audio download
                res.setHeader('Content-Type', 'audio/wav');
                res.setHeader('Content-Disposition', `attachment; filename="${stem}_${job.inputFile.replace(/\.[^/.]+$/, '')}.wav"`);
                
                res.download(stemFile, `${stem}.wav`, (error) => {
                    if (error) {
                        logger.error(`Download error for ${stemFile}:`, error);
                        if (!res.headersSent) {
                            res.status(500).json({
                                success: false,
                                error: 'Download failed'
                            });
                        }
                    }
                });
                
            } catch (error) {
                res.status(404).json({
                    success: false,
                    error: 'Stem file not found',
                    message: `The ${stem} stem file could not be found`
                });
            }

        } catch (error) {
            logger.error('Error downloading stem:', error);
            res.status(500).json({
                success: false,
                error: 'Download failed',
                message: error.message
            });
        }
    }

    /**
     * Cancel job and cleanup files
     */
    async cancelJob(req, res) {
        try {
            const { jobId } = req.params;
            const job = jobs.get(jobId);

            if (!job) {
                return res.status(404).json({
                    success: false,
                    error: 'Job not found'
                });
            }

            if (job.status === 'completed') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot cancel completed job'
                });
            }

            // Update job status
            jobs.set(jobId, {
                ...job,
                status: 'cancelled',
                endTime: new Date()
            });

            // Cleanup files
            const outputDir = path.join(__dirname, '..', process.env.OUTPUT_DIR || 'outputs', jobId);
            try {
                await fs.rmdir(outputDir, { recursive: true });
            } catch (cleanupError) {
                logger.warn(`Failed to cleanup files for job ${jobId}:`, cleanupError.message);
            }

            logger.info(`❌ Job ${jobId} cancelled`);

            res.json({
                success: true,
                message: 'Job cancelled successfully'
            });

        } catch (error) {
            logger.error('Error cancelling job:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to cancel job',
                message: error.message
            });
        }
    }

    /**
     * Get recent jobs
     */
    async getRecentJobs(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 100;
            const recentJobs = Array.from(jobs.values())
                .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
                .slice(0, limit)
                .map(job => ({
                    id: job.id,
                    status: job.status,
                    inputFile: job.inputFile,
                    model: job.model,
                    startTime: job.startTime,
                    endTime: job.endTime,
                    processingTime: job.processingTime
                }));

            res.json({
                success: true,
                jobs: recentJobs,
                total: jobs.size
            });

        } catch (error) {
            logger.error('Error getting recent jobs:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get recent jobs',
                message: error.message
            });
        }
    }

    /**
     * Estimate processing time based on file size and model
     */
    estimateProcessingTime(fileSize, model) {
        const fileSizeMB = fileSize / (1024 * 1024);
        const baseTimePerMB = model === 'demucs' ? 8 : 4; // seconds per MB
        return Math.round(fileSizeMB * baseTimePerMB);
    }

    /**
     * Cleanup old jobs (older than 24 hours)
     */
    cleanupOldJobs() {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        let cleanedCount = 0;

        for (const [jobId, job] of jobs.entries()) {
            if (new Date(job.startTime) < oneDayAgo) {
                jobs.delete(jobId);
                cleanedCount++;

                // Cleanup files
                const outputDir = path.join(__dirname, '..', process.env.OUTPUT_DIR || 'outputs', jobId);
                fs.rmdir(outputDir, { recursive: true }).catch(() => {});
            }
        }

        if (cleanedCount > 0) {
            logger.info(`🧹 Cleaned up ${cleanedCount} old jobs`);
        }
    }
}

module.exports = new AudioController();
