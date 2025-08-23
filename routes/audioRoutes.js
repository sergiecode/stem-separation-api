const express = require('express');
const { upload } = require('../middleware/upload');
const audioController = require('../controllers/audioController');
const validation = require('../middleware/validation');
const auth = require('../middleware/auth');

const router = express.Router();

/**
 * @route   GET /api/audio/models
 * @desc    Get available AI models for stem separation
 * @access  Public
 */
router.get('/models', audioController.getModels);

/**
 * @route   POST /api/audio/separate
 * @desc    Upload audio file and start stem separation process
 * @access  Public (consider adding auth.apiKey for production)
 */
router.post('/separate', 
    // auth.apiKey, // Uncomment for production
    upload.single('audio'),
    validation.validateAudioFile,
    validation.validateProcessingOptions,
    audioController.separateStems
);

/**
 * @route   GET /api/audio/status/:jobId
 * @desc    Get processing status for a specific job
 * @access  Public
 */
router.get('/status/:jobId', 
    validation.validateJobId,
    audioController.getStatus
);

/**
 * @route   GET /api/audio/download/:jobId/:stem
 * @desc    Download a specific separated stem
 * @access  Public
 */
router.get('/download/:jobId/:stem', 
    validation.validateJobId,
    validation.validateStemName,
    audioController.downloadStem
);

/**
 * @route   DELETE /api/audio/job/:jobId
 * @desc    Cancel a processing job and cleanup files
 * @access  Public
 */
router.delete('/job/:jobId',
    validation.validateJobId,
    audioController.cancelJob
);

/**
 * @route   GET /api/audio/jobs
 * @desc    Get list of recent jobs (last 100)
 * @access  Public (consider adding auth for production)
 */
router.get('/jobs', audioController.getRecentJobs);

module.exports = router;
