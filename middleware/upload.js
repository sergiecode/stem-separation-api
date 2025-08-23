const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    logger.info(`📁 Created upload directory: ${uploadDir}`);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Create unique filename with timestamp and random suffix
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const extension = path.extname(sanitizedOriginalName);
        const baseName = path.basename(sanitizedOriginalName, extension);
        
        const finalName = `${baseName}-${uniqueSuffix}${extension}`;
        logger.info(`📤 Uploading file: ${file.originalname} -> ${finalName}`);
        
        cb(null, finalName);
    }
});

const fileFilter = (req, file, cb) => {
    logger.info(`🔍 Checking file type: ${file.mimetype} for file: ${file.originalname}`);
    
    const allowedTypes = [
        'audio/mpeg',        // MP3
        'audio/wav',         // WAV
        'audio/x-wav',       // WAV (alternative)
        'audio/wave',        // WAV (alternative)
        'audio/flac',        // FLAC
        'audio/x-flac',      // FLAC (alternative)
        'audio/m4a',         // M4A
        'audio/aac',         // AAC
        'audio/ogg',         // OGG
        'audio/vorbis',      // OGG Vorbis
        'audio/webm',        // WebM
        'audio/mp4',         // MP4 audio
        'application/octet-stream' // Sometimes audio files are detected as this
    ];

    // Also check file extension as backup
    const allowedExtensions = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.wma', '.mp4'];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    const isValidMimeType = allowedTypes.includes(file.mimetype);
    const isValidExtension = allowedExtensions.includes(fileExtension);

    if (isValidMimeType || isValidExtension) {
        logger.info(`✅ File type accepted: ${file.mimetype} (${fileExtension})`);
        cb(null, true);
    } else {
        logger.warn(`❌ File type rejected: ${file.mimetype} (${fileExtension})`);
        cb(new Error(`Invalid file type. Supported formats: ${allowedExtensions.join(', ')}`), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 500 * 1024 * 1024, // 500MB default
        files: 1 // Only allow one file at a time
    },
    onError: (err, next) => {
        logger.error('Upload error:', err);
        next(err);
    }
});

// Error handling middleware for multer errors
const handleUploadError = (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        logger.error('Multer error:', error);
        
        switch (error.code) {
            case 'LIMIT_FILE_SIZE':
                return res.status(413).json({
                    success: false,
                    error: 'File too large',
                    message: `Maximum file size is ${Math.round((process.env.MAX_FILE_SIZE || 500 * 1024 * 1024) / 1024 / 1024)}MB`,
                    maxSize: process.env.MAX_FILE_SIZE || 500 * 1024 * 1024
                });
            
            case 'LIMIT_FILE_COUNT':
                return res.status(400).json({
                    success: false,
                    error: 'Too many files',
                    message: 'Only one audio file can be uploaded at a time'
                });
            
            case 'LIMIT_UNEXPECTED_FILE':
                return res.status(400).json({
                    success: false,
                    error: 'Unexpected file field',
                    message: 'Please use the "audio" field for file upload'
                });
            
            default:
                return res.status(400).json({
                    success: false,
                    error: 'Upload error',
                    message: error.message
                });
        }
    }

    if (error.message.includes('Invalid file type')) {
        return res.status(400).json({
            success: false,
            error: 'Invalid file type',
            message: error.message,
            supportedFormats: ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg']
        });
    }

    next(error);
};

module.exports = {
    upload,
    handleUploadError
};
