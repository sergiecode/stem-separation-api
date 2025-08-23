const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const util = require('util');
const logger = require('../utils/logger');

const execAsync = util.promisify(exec);

class StemSeparatorService {
    constructor() {
        this.config = {
            pythonPath: process.env.PYTHON_PATH || 'python',
            projectPath: process.env.SEPARATOR_PROJECT_PATH || path.join(__dirname, '../../../audio-stem-separator'),
            defaultModel: process.env.DEFAULT_MODEL || 'demucs',
            timeout: parseInt(process.env.PROCESSING_TIMEOUT) || 300000, // 5 minutes
            maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 500 * 1024 * 1024 // 500MB
        };

        logger.info('🔧 StemSeparatorService initialized with config:', {
            pythonPath: this.config.pythonPath,
            projectPath: this.config.projectPath,
            defaultModel: this.config.defaultModel,
            timeout: this.config.timeout / 1000 + 's'
        });
    }

    /**
     * Separate audio into stems
     * @param {string} inputFile - Path to input audio file
     * @param {string} outputDir - Output directory
     * @param {object} options - Processing options
     * @param {function} progressCallback - Optional progress callback
     */
    async separateStems(inputFile, outputDir, options = {}, progressCallback = null) {
        const {
            model = this.config.defaultModel,
            device = 'auto',
            format = 'wav',
            verbose = false
        } = options;

        logger.info(`🎵 Starting stem separation for: ${path.basename(inputFile)}`);
        logger.info(`📊 Options: model=${model}, device=${device}, format=${format}`);

        // Validate input file exists
        try {
            await fs.access(inputFile);
            const stats = await fs.stat(inputFile);
            logger.info(`📁 Input file size: ${Math.round(stats.size / 1024 / 1024)}MB`);
        } catch (error) {
            throw new Error(`Input file not found: ${inputFile}`);
        }

        // Create output directory if it doesn't exist
        await fs.mkdir(outputDir, { recursive: true });

        // Build command
        const args = [
            '-m', 'src.main',
            '--input', `"${inputFile}"`,
            '--output', `"${outputDir}"`,
            '--model', model,
            '--device', device
        ];

        if (!verbose) {
            args.push('--quiet');
        }

        const command = `${this.config.pythonPath} ${args.join(' ')}`;

        try {
            logger.info(`🤖 Executing: ${command.substring(0, 100)}...`);
            
            if (progressCallback) {
                progressCallback(10, 'Loading AI model...');
            }

            const { stdout, stderr } = await execAsync(command, {
                cwd: this.config.projectPath,
                timeout: this.config.timeout,
                maxBuffer: 1024 * 1024 * 10, // 10MB buffer
                env: {
                    ...process.env,
                    PYTHONPATH: this.config.projectPath
                }
            });

            if (progressCallback) {
                progressCallback(90, 'Finalizing stems...');
            }

            // Parse JSON result
            let result;
            try {
                result = JSON.parse(stdout);
            } catch (parseError) {
                logger.error('Failed to parse Python output:', stdout);
                throw new Error('Invalid response from Python backend');
            }
            
            if (result.success) {
                logger.info(`✅ Separation completed in ${result.processing_time}s`);
                
                // Add file URLs and verify files exist
                result.files = await this.getOutputFiles(outputDir, result.stems);
                
                // Add download URLs
                result.downloadUrls = {};
                Object.keys(result.files).forEach(stem => {
                    if (result.files[stem].exists) {
                        result.downloadUrls[stem] = `/download/${path.basename(outputDir)}/${stem}.${format}`;
                    }
                });

                if (progressCallback) {
                    progressCallback(100, 'Stem separation completed successfully!');
                }
            } else {
                logger.error(`❌ Separation failed: ${result.error}`);
            }

            return result;

        } catch (error) {
            logger.error('💥 Stem separation crashed:', error);

            if (error.code === 'TIMEOUT') {
                throw new Error('Audio processing timed out. Try with a shorter audio file or increase timeout.');
            }

            // Try to parse error as JSON
            try {
                const errorResult = JSON.parse(error.stdout || error.stderr);
                return errorResult;
            } catch {
                throw new Error(`Processing failed: ${error.message}`);
            }
        }
    }

    /**
     * Get output file paths and verify existence
     */
    async getOutputFiles(outputDir, stemNames) {
        const files = {};
        
        for (const stem of stemNames) {
            const extensions = ['wav', 'flac', 'mp3']; // Try multiple extensions
            let fileFound = false;

            for (const ext of extensions) {
                const filePath = path.join(outputDir, `${stem}.${ext}`);
                try {
                    const stats = await fs.stat(filePath);
                    files[stem] = {
                        path: filePath,
                        url: `/download/${path.basename(outputDir)}/${stem}.${ext}`,
                        exists: true,
                        size: stats.size,
                        format: ext
                    };
                    fileFound = true;
                    break;
                } catch {
                    // File doesn't exist, try next extension
                }
            }

            if (!fileFound) {
                files[stem] = {
                    path: null,
                    url: null,
                    exists: false,
                    size: 0,
                    format: null
                };
            }
        }

        return files;
    }

    /**
     * Get available models
     */
    async getAvailableModels() {
        try {
            const { stdout } = await execAsync(`${this.config.pythonPath} -m src.main --list-models`, {
                cwd: this.config.projectPath,
                timeout: 10000
            });

            const result = JSON.parse(stdout);
            
            if (result.success) {
                return result.models;
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            logger.warn('Failed to get models from Python backend, using defaults:', error.message);
            
            // Return default models if Python backend is not available
            return [
                {
                    name: 'demucs',
                    description: 'Demucs v4 - High quality separation, slower processing',
                    stems: ['vocals', 'drums', 'bass', 'other'],
                    default: true
                },
                {
                    name: 'openunmix',
                    description: 'Open-Unmix - Good quality, faster processing',
                    stems: ['vocals', 'drums', 'bass', 'other'],
                    default: false
                },
                {
                    name: 'demucs_6s',
                    description: 'Demucs 6-stem - Separates 6 instruments',
                    stems: ['vocals', 'drums', 'bass', 'piano', 'guitar', 'other'],
                    default: false
                }
            ];
        }
    }

    /**
     * Check if the service is available
     */
    async healthCheck() {
        try {
            logger.info('🏥 Performing health check...');
            
            // Check if Python is available
            const { stdout: pythonVersion } = await execAsync(`${this.config.pythonPath} --version`, {
                timeout: 5000
            });
            
            logger.info(`🐍 Python version: ${pythonVersion.trim()}`);

            // Check if project directory exists
            await fs.access(this.config.projectPath);
            logger.info(`📂 Project directory found: ${this.config.projectPath}`);

            // Check if main script exists
            const mainScript = path.join(this.config.projectPath, 'src', 'main.py');
            await fs.access(mainScript);
            logger.info(`📜 Main script found: ${mainScript}`);

            // Try to run help command
            const { stdout } = await execAsync(`${this.config.pythonPath} -m src.main --help`, {
                cwd: this.config.projectPath,
                timeout: 15000
            });

            logger.info('✅ Health check passed');
            
            return { 
                available: true, 
                message: 'Service is ready',
                pythonVersion: pythonVersion.trim(),
                projectPath: this.config.projectPath
            };

        } catch (error) {
            logger.error('❌ Health check failed:', error.message);
            
            return { 
                available: false, 
                message: `Service unavailable: ${error.message}`,
                suggestions: [
                    'Ensure Python is installed and accessible',
                    'Check SEPARATOR_PROJECT_PATH environment variable',
                    'Verify audio-stem-separator project is properly set up',
                    'Run: pip install -r requirements.txt in the Python project'
                ]
            };
        }
    }

    /**
     * Get service information
     */
    async getServiceInfo() {
        const healthStatus = await this.healthCheck();
        
        return {
            service: 'Stem Separator Service',
            version: '1.0.0',
            author: 'Sergie Code',
            status: healthStatus.available ? 'available' : 'unavailable',
            config: {
                pythonPath: this.config.pythonPath,
                projectPath: this.config.projectPath,
                defaultModel: this.config.defaultModel,
                maxFileSize: `${Math.round(this.config.maxFileSize / 1024 / 1024)}MB`,
                timeout: `${this.config.timeout / 1000}s`
            },
            health: healthStatus
        };
    }
}

module.exports = StemSeparatorService;
