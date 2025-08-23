const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

/**
 * Validate uploaded audio file
 */
const validateAudioFile = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No audio file provided',
                message: 'Please upload an audio file using the "audio" field'
            });
        }

        // Check file size
        const stats = await fs.stat(req.file.path);
        if (stats.size === 0) {
            await fs.unlink(req.file.path).catch(() => {});
            return res.status(400).json({
                success: false,
                error: 'Uploaded file is empty',
                message: 'The uploaded file contains no data'
            });
        }

        // Validate file extension
        const allowedExtensions = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.wma', '.mp4'];
        const fileExtension = path.extname(req.file.originalname).toLowerCase();
        
        if (!allowedExtensions.includes(fileExtension)) {
            await fs.unlink(req.file.path).catch(() => {});
            return res.status(400).json({
                success: false,
                error: 'Invalid file extension',
                message: `File extension ${fileExtension} is not supported`,
                supportedExtensions: allowedExtensions
            });
        }

        logger.info(`✅ File validation passed: ${req.file.originalname} (${Math.round(stats.size / 1024 / 1024)}MB)`);
        next();

    } catch (error) {
        logger.error('File validation error:', error);
        
        if (req.file) {
            await fs.unlink(req.file.path).catch(() => {});
        }
        
        res.status(500).json({
            success: false,
            error: 'File validation failed',
            message: error.message
        });
    }
};

/**
 * Validate processing options
 */
const validateProcessingOptions = (req, res, next) => {
    try {
        const { model, device, format } = req.body;

        // Validate model
        const allowedModels = ['demucs', 'openunmix', 'demucs_6s', 'htdemucs'];
        if (model && !allowedModels.includes(model)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid model',
                message: `Model "${model}" is not supported`,
                allowedModels: allowedModels
            });
        }

        // Validate device
        const allowedDevices = ['auto', 'cpu', 'cuda', 'mps'];
        if (device && !allowedDevices.includes(device)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid device',
                message: `Device "${device}" is not supported`,
                allowedDevices: allowedDevices
            });
        }

        // Validate format
        const allowedFormats = ['wav', 'flac', 'mp3'];
        if (format && !allowedFormats.includes(format)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid output format',
                message: `Format "${format}" is not supported`,
                allowedFormats: allowedFormats
            });
        }

        logger.info(`🔧 Processing options validated: model=${model || 'default'}, device=${device || 'auto'}, format=${format || 'wav'}`);
        next();

    } catch (error) {
        logger.error('Processing options validation error:', error);
        res.status(500).json({
            success: false,
            error: 'Validation failed',
            message: error.message
        });
    }
};

/**
 * Validate job ID format
 */
const validateJobId = (req, res, next) => {
    try {
        const { jobId } = req.params;
        
        // Check if jobId is a valid UUID v4
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        
        if (!jobId || !uuidRegex.test(jobId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid job ID',
                message: 'Job ID must be a valid UUID'
            });
        }

        logger.debug(`✅ Job ID validated: ${jobId}`);
        next();

    } catch (error) {
        logger.error('Job ID validation error:', error);
        res.status(500).json({
            success: false,
            error: 'Validation failed',
            message: error.message
        });
    }
};

/**
 * Validate stem name
 */
const validateStemName = (req, res, next) => {
    try {
        const { stem } = req.params;
        
        // Common stem names from different models
        const allowedStems = [
            'vocals', 'drums', 'bass', 'other',  // Standard 4-stem
            'piano', 'guitar',                    // Additional stems for 6-stem models
            'accompaniment', 'lead'               // Alternative names
        ];
        
        if (!stem || !allowedStems.includes(stem.toLowerCase())) {
            return res.status(400).json({
                success: false,
                error: 'Invalid stem name',
                message: `Stem "${stem}" is not valid`,
                allowedStems: allowedStems
            });
        }

        logger.debug(`✅ Stem name validated: ${stem}`);
        next();

    } catch (error) {
        logger.error('Stem name validation error:', error);
        res.status(500).json({
            success: false,
            error: 'Validation failed',
            message: error.message
        });
    }
};

/**
 * Validate API rate limiting (basic implementation)
 */
const rateLimiter = (() => {
    const requests = new Map();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxRequests = 10; // Max 10 requests per window

    return (req, res, next) => {
        const clientIp = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        
        if (!requests.has(clientIp)) {
            requests.set(clientIp, []);
        }
        
        const clientRequests = requests.get(clientIp);
        
        // Remove old requests outside the window
        const validRequests = clientRequests.filter(timestamp => now - timestamp < windowMs);
        
        if (validRequests.length >= maxRequests) {
            return res.status(429).json({
                success: false,
                error: 'Rate limit exceeded',
                message: `Maximum ${maxRequests} requests per ${windowMs / 1000 / 60} minutes`,
                retryAfter: Math.ceil((validRequests[0] + windowMs - now) / 1000)
            });
        }
        
        validRequests.push(now);
        requests.set(clientIp, validRequests);
        
        next();
    };
})();

/**
 * Validate request size
 */
const validateRequestSize = (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length']);
    const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 500 * 1024 * 1024;
    
    if (contentLength && contentLength > maxSize) {
        return res.status(413).json({
            success: false,
            error: 'Request too large',
            message: `Maximum request size is ${Math.round(maxSize / 1024 / 1024)}MB`,
            maxSize: maxSize
        });
    }
    
    next();
};

module.exports = {
    validateAudioFile,
    validateProcessingOptions,
    validateJobId,
    validateStemName,
    rateLimiter,
    validateRequestSize
};
