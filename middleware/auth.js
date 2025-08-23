const logger = require('../utils/logger');

/**
 * Simple API Key authentication middleware
 */
const apiKey = (req, res, next) => {
    const providedKey = req.headers['x-api-key'] || req.query.apiKey;
    const validApiKey = process.env.API_KEY;

    // Skip authentication if no API key is configured
    if (!validApiKey || validApiKey === 'your-api-key-here') {
        logger.warn('⚠️ API key authentication is disabled. Set API_KEY environment variable for production.');
        return next();
    }

    if (!providedKey) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required',
            message: 'Please provide an API key in the X-API-Key header or apiKey query parameter'
        });
    }

    if (providedKey !== validApiKey) {
        logger.warn(`❌ Invalid API key attempt from IP: ${req.ip}`);
        return res.status(403).json({
            success: false,
            error: 'Invalid API key',
            message: 'The provided API key is not valid'
        });
    }

    logger.debug(`✅ API key authenticated for IP: ${req.ip}`);
    next();
};

/**
 * Basic IP whitelist middleware
 */
const ipWhitelist = (allowedIPs = []) => {
    return (req, res, next) => {
        if (allowedIPs.length === 0) {
            return next(); // No restrictions if whitelist is empty
        }

        const clientIP = req.ip || req.connection.remoteAddress;
        
        if (!allowedIPs.includes(clientIP)) {
            logger.warn(`❌ IP access denied: ${clientIP}`);
            return res.status(403).json({
                success: false,
                error: 'Access denied',
                message: 'Your IP address is not authorized to access this service'
            });
        }

        logger.debug(`✅ IP authorized: ${clientIP}`);
        next();
    };
};

/**
 * CORS preflight handler
 */
const corsHandler = (req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigins = (process.env.CORS_ORIGIN || '*').split(',');

    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    next();
};

/**
 * Security headers middleware
 */
const securityHeaders = (req, res, next) => {
    // Remove server identification
    res.removeHeader('X-Powered-By');
    
    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Only set HTTPS headers in production
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    next();
};

/**
 * Request logging middleware
 */
const requestLogger = (req, res, next) => {
    const start = Date.now();
    const clientIP = req.ip || req.connection.remoteAddress;
    
    logger.info(`📥 ${req.method} ${req.originalUrl} - ${clientIP}`);
    
    // Log response
    res.on('finish', () => {
        const duration = Date.now() - start;
        const statusIcon = res.statusCode < 400 ? '✅' : '❌';
        logger.info(`📤 ${statusIcon} ${res.statusCode} ${req.method} ${req.originalUrl} - ${duration}ms`);
    });

    next();
};

module.exports = {
    apiKey,
    ipWhitelist,
    corsHandler,
    securityHeaders,
    requestLogger
};
