const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

/**
 * Ensure required directories exist
 */
const ensureDirectories = async () => {
    const directories = [
        process.env.UPLOAD_DIR || 'uploads',
        process.env.OUTPUT_DIR || 'outputs',
        'logs',
        'temp'
    ];

    for (const dir of directories) {
        const fullPath = path.join(__dirname, '..', dir);
        try {
            await fs.access(fullPath);
            logger.info(`📁 Directory exists: ${fullPath}`);
        } catch (error) {
            await fs.mkdir(fullPath, { recursive: true });
            logger.info(`📁 Created directory: ${fullPath}`);
        }
    }
};

/**
 * Clean up old files in a directory
 * @param {string} directory - Directory to clean
 * @param {number} maxAgeHours - Maximum age in hours
 */
const cleanupOldFiles = async (directory, maxAgeHours = 24) => {
    try {
        const fullPath = path.join(__dirname, '..', directory);
        const files = await fs.readdir(fullPath);
        const now = Date.now();
        const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds
        
        let cleanedCount = 0;

        for (const file of files) {
            const filePath = path.join(fullPath, file);
            try {
                const stats = await fs.stat(filePath);
                const age = now - stats.mtime.getTime();

                if (age > maxAge) {
                    await fs.unlink(filePath);
                    cleanedCount++;
                    logger.debug(`🗑️ Cleaned up old file: ${file}`);
                }
            } catch (error) {
                logger.warn(`Failed to cleanup file ${file}:`, error.message);
            }
        }

        if (cleanedCount > 0) {
            logger.info(`🧹 Cleaned up ${cleanedCount} old files from ${directory}`);
        }

        return cleanedCount;
    } catch (error) {
        logger.error(`Failed to cleanup directory ${directory}:`, error);
        return 0;
    }
};

/**
 * Get file size in a human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Human-readable file size
 */
const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Get directory size recursively
 * @param {string} dirPath - Directory path
 * @returns {Promise<number>} Total size in bytes
 */
const getDirectorySize = async (dirPath) => {
    let totalSize = 0;
    
    try {
        const files = await fs.readdir(dirPath);
        
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stats = await fs.stat(filePath);
            
            if (stats.isDirectory()) {
                totalSize += await getDirectorySize(filePath);
            } else {
                totalSize += stats.size;
            }
        }
    } catch (error) {
        logger.warn(`Failed to calculate directory size for ${dirPath}:`, error.message);
    }
    
    return totalSize;
};

/**
 * Safely delete a file or directory
 * @param {string} filePath - Path to file or directory
 * @returns {Promise<boolean>} True if deleted successfully
 */
const safeDelete = async (filePath) => {
    try {
        const stats = await fs.stat(filePath);
        
        if (stats.isDirectory()) {
            await fs.rmdir(filePath, { recursive: true });
        } else {
            await fs.unlink(filePath);
        }
        
        logger.debug(`🗑️ Safely deleted: ${filePath}`);
        return true;
    } catch (error) {
        if (error.code !== 'ENOENT') { // Ignore "file not found" errors
            logger.warn(`Failed to delete ${filePath}:`, error.message);
        }
        return false;
    }
};

/**
 * Copy a file with progress tracking
 * @param {string} source - Source file path
 * @param {string} destination - Destination file path
 * @param {function} progressCallback - Optional progress callback
 */
const copyFileWithProgress = async (source, destination, progressCallback = null) => {
    const readStream = require('fs').createReadStream(source);
    const writeStream = require('fs').createWriteStream(destination);
    
    let totalBytes = 0;
    let copiedBytes = 0;
    
    // Get file size for progress calculation
    try {
        const stats = await fs.stat(source);
        totalBytes = stats.size;
    } catch (error) {
        logger.error('Failed to get source file stats:', error);
        throw error;
    }
    
    return new Promise((resolve, reject) => {
        readStream.on('data', (chunk) => {
            copiedBytes += chunk.length;
            if (progressCallback && totalBytes > 0) {
                const progress = Math.round((copiedBytes / totalBytes) * 100);
                progressCallback(progress);
            }
        });
        
        readStream.on('error', reject);
        writeStream.on('error', reject);
        writeStream.on('finish', () => {
            logger.debug(`📋 File copied: ${source} -> ${destination}`);
            resolve();
        });
        
        readStream.pipe(writeStream);
    });
};

/**
 * Check if a file is an audio file based on extension
 * @param {string} filename - File name
 * @returns {boolean} True if it's an audio file
 */
const isAudioFile = (filename) => {
    const audioExtensions = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.wma', '.mp4'];
    const extension = path.extname(filename).toLowerCase();
    return audioExtensions.includes(extension);
};

/**
 * Sanitize filename for safe storage
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
const sanitizeFilename = (filename) => {
    // Remove or replace unsafe characters
    return filename
        .replace(/[<>:"/\\|?*]/g, '_')  // Replace unsafe characters with underscore
        .replace(/\s+/g, '_')          // Replace spaces with underscore
        .replace(/_+/g, '_')           // Replace multiple underscores with single
        .replace(/^_+|_+$/g, '')       // Remove leading and trailing underscores
        .substring(0, 255);            // Limit length to 255 characters
};

/**
 * Get disk space information
 * @param {string} path - Path to check
 * @returns {Promise<object>} Disk space information
 */
const getDiskSpace = async (dirPath = __dirname) => {
    try {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        // Use different commands based on OS
        const isWindows = process.platform === 'win32';
        const command = isWindows 
            ? `wmic logicaldisk where caption="${path.resolve(dirPath).charAt(0)}:" get size,freespace /value`
            : `df -k "${dirPath}"`;
        
        const { stdout } = await execAsync(command);
        
        if (isWindows) {
            const lines = stdout.split('\n').filter(line => line.trim());
            const freeSpace = lines.find(line => line.startsWith('FreeSpace='));
            const size = lines.find(line => line.startsWith('Size='));
            
            if (freeSpace && size) {
                const free = parseInt(freeSpace.split('=')[1]);
                const total = parseInt(size.split('=')[1]);
                const used = total - free;
                
                return {
                    total: total,
                    free: free,
                    used: used,
                    usedPercentage: Math.round((used / total) * 100)
                };
            }
        } else {
            const lines = stdout.trim().split('\n');
            if (lines.length >= 2) {
                const values = lines[1].split(/\s+/);
                const total = parseInt(values[1]) * 1024; // Convert from KB to bytes
                const used = parseInt(values[2]) * 1024;
                const free = parseInt(values[3]) * 1024;
                
                return {
                    total: total,
                    free: free,
                    used: used,
                    usedPercentage: Math.round((used / total) * 100)
                };
            }
        }
        
        throw new Error('Could not parse disk space information');
        
    } catch (error) {
        logger.warn('Failed to get disk space information:', error.message);
        return null;
    }
};

/**
 * Start automatic cleanup of old files
 * @param {number} intervalHours - Cleanup interval in hours
 * @param {number} maxAgeHours - Maximum file age in hours
 */
const startAutomaticCleanup = (intervalHours = 6, maxAgeHours = 24) => {
    const interval = intervalHours * 60 * 60 * 1000; // Convert to milliseconds
    
    logger.info(`🧹 Starting automatic cleanup every ${intervalHours}h for files older than ${maxAgeHours}h`);
    
    setInterval(async () => {
        logger.info('🧹 Running automatic cleanup...');
        
        const uploadCleanup = await cleanupOldFiles(process.env.UPLOAD_DIR || 'uploads', maxAgeHours);
        const outputCleanup = await cleanupOldFiles(process.env.OUTPUT_DIR || 'outputs', maxAgeHours);
        const tempCleanup = await cleanupOldFiles('temp', maxAgeHours / 2); // Clean temp files more frequently
        
        const totalCleaned = uploadCleanup + outputCleanup + tempCleanup;
        logger.info(`🧹 Automatic cleanup completed: ${totalCleaned} files removed`);
        
    }, interval);
};

module.exports = {
    ensureDirectories,
    cleanupOldFiles,
    formatFileSize,
    getDirectorySize,
    safeDelete,
    copyFileWithProgress,
    isAudioFile,
    sanitizeFilename,
    getDiskSpace,
    startAutomaticCleanup
};
