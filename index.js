const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const audioRoutes = require('./routes/audioRoutes');
const logger = require('./utils/logger');
const { ensureDirectories } = require('./utils/fileUtils');

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize Socket.IO
const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST"]
    }
});

// Make io available to other modules
app.set('io', io);

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

// Logging middleware
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file serving for downloads
app.use('/download', express.static(path.join(__dirname, process.env.OUTPUT_DIR || 'outputs')));

// Routes
app.use('/api/audio', audioRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const StemSeparatorService = require('./services/stemSeparatorService');
        const service = new StemSeparatorService();
        
        const health = await service.healthCheck();
        
        res.status(health.available ? 200 : 503).json({
            status: health.available ? 'healthy' : 'unhealthy',
            service: 'Stem Separation API',
            version: require('./package.json').version,
            message: health.message,
            timestamp: new Date().toISOString(),
            author: 'Sergie Code'
        });
    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({
            status: 'unhealthy',
            service: 'Stem Separation API',
            message: 'Service unavailable',
            timestamp: new Date().toISOString()
        });
    }
});

// API documentation endpoint
app.get('/api', (req, res) => {
    res.json({
        service: 'Stem Separation API',
        version: require('./package.json').version,
        author: 'Sergie Code',
        description: 'AI-powered audio stem separation API for musicians',
        endpoints: {
            health: 'GET /health',
            models: 'GET /api/audio/models',
            separate: 'POST /api/audio/separate',
            status: 'GET /api/audio/status/:jobId',
            download: 'GET /api/audio/download/:jobId/:stem'
        },
        documentation: 'https://github.com/sergieCode/stem-separation-api'
    });
});

// WebSocket connection handling
io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    socket.on('subscribe-job', (jobId) => {
        socket.join(`job-${jobId}`);
        logger.info(`Client ${socket.id} subscribed to job ${jobId}`);
    });

    socket.on('unsubscribe-job', (jobId) => {
        socket.leave(`job-${jobId}`);
        logger.info(`Client ${socket.id} unsubscribed from job ${jobId}`);
    });

    socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    logger.error('Unhandled error:', error);
    
    if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
            success: false,
            error: 'File too large',
            message: `Maximum file size is ${Math.round((process.env.MAX_FILE_SIZE || 524288000) / 1024 / 1024)}MB`
        });
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
            success: false,
            error: 'Unexpected file field',
            message: 'Please use the "audio" field for file upload'
        });
    }

    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        message: `The endpoint ${req.method} ${req.originalUrl} does not exist`,
        availableEndpoints: [
            'GET /health',
            'GET /api',
            'POST /api/audio/separate',
            'GET /api/audio/status/:jobId',
            'GET /api/audio/models'
        ]
    });
});

// Initialize application
async function startServer() {
    try {
        // Ensure required directories exist
        await ensureDirectories();
        
        server.listen(PORT, () => {
            logger.info(`🎵 Stem Separation API by Sergie Code running on port ${PORT}`);
            logger.info(`📚 API documentation: http://localhost:${PORT}/api`);
            logger.info(`🏥 Health check: http://localhost:${PORT}/health`);
            logger.info(`🌐 Environment: ${process.env.NODE_ENV}`);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        logger.info('Server closed.');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received. Shutting down gracefully...');
    server.close(() => {
        logger.info('Server closed.');
        process.exit(0);
    });
});

startServer();

module.exports = app;
