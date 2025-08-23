const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const logDir = path.join(__dirname, '..', 'logs');

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { 
        service: 'stem-separation-api',
        author: 'Sergie Code'
    },
    transports: [
        // Write all logs with level 'error' and below to error.log
        new winston.transports.File({ 
            filename: path.join(logDir, 'error.log'), 
            level: 'error',
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5
        }),
        
        // Write all logs with level 'info' and below to combined.log
        new winston.transports.File({ 
            filename: path.join(logDir, 'combined.log'),
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5
        })
    ]
});

// If we're not in production, log to the console as well
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({
                format: 'HH:mm:ss'
            }),
            winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
                let output = `${timestamp} [${level}] ${message}`;
                
                // Add meta information if present
                if (Object.keys(meta).length > 0) {
                    output += ' ' + JSON.stringify(meta, null, 2);
                }
                
                return output;
            })
        )
    }));
}

// Create a stream object for Morgan HTTP request logging
logger.stream = {
    write: (message) => {
        logger.info(message.trim());
    }
};

// Add custom methods for specific log types
logger.request = (req, message) => {
    logger.info(message, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        url: req.originalUrl
    });
};

logger.security = (message, meta = {}) => {
    logger.warn(message, { 
        type: 'security',
        ...meta 
    });
};

logger.performance = (message, duration, meta = {}) => {
    logger.info(message, {
        type: 'performance',
        duration: `${duration}ms`,
        ...meta
    });
};

logger.apiUsage = (endpoint, statusCode, duration, meta = {}) => {
    logger.info('API usage', {
        type: 'api-usage',
        endpoint,
        statusCode,
        duration: `${duration}ms`,
        ...meta
    });
};

// Ensure log directory exists
const fs = require('fs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Log startup information
if (process.env.NODE_ENV !== 'test') {
    logger.info('🚀 Stem Separation API Logger initialized', {
        logLevel: logger.level,
        environment: process.env.NODE_ENV || 'development',
        logDirectory: logDir
    });
}

module.exports = logger;
