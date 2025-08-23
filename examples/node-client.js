const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

/**
 * Node.js client example for the Stem Separation API
 * Created by Sergie Code
 */

class StemSeparationClient {
    constructor(baseURL = 'http://localhost:3000', apiKey = null) {
        this.baseURL = baseURL;
        this.apiKey = apiKey;
        this.axios = axios.create({
            baseURL: this.baseURL,
            timeout: 600000, // 10 minutes timeout
            headers: {
                'User-Agent': 'StemSeparationClient/1.0.0'
            }
        });

        // Add API key to requests if provided
        if (this.apiKey) {
            this.axios.defaults.headers['X-API-Key'] = this.apiKey;
        }
    }

    /**
     * Check if the API is healthy
     */
    async healthCheck() {
        try {
            const response = await this.axios.get('/health');
            return response.data;
        } catch (error) {
            throw new Error(`Health check failed: ${error.message}`);
        }
    }

    /**
     * Get available AI models
     */
    async getModels() {
        try {
            const response = await this.axios.get('/api/audio/models');
            return response.data;
        } catch (error) {
            throw new Error(`Failed to get models: ${error.message}`);
        }
    }

    /**
     * Upload and separate audio file
     */
    async separateStems(audioFilePath, options = {}) {
        try {
            // Check if file exists
            if (!fs.existsSync(audioFilePath)) {
                throw new Error(`Audio file not found: ${audioFilePath}`);
            }

            // Get file stats
            const stats = fs.statSync(audioFilePath);
            console.log(`📁 Uploading: ${path.basename(audioFilePath)} (${Math.round(stats.size / 1024 / 1024)}MB)`);

            // Create form data
            const formData = new FormData();
            formData.append('audio', fs.createReadStream(audioFilePath));
            
            if (options.model) formData.append('model', options.model);
            if (options.device) formData.append('device', options.device);
            if (options.format) formData.append('format', options.format);

            // Upload and start processing
            const response = await this.axios.post('/api/audio/separate', formData, {
                headers: {
                    ...formData.getHeaders(),
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });

            return response.data;
        } catch (error) {
            if (error.response) {
                throw new Error(`API Error: ${error.response.data.message || error.response.data.error}`);
            }
            throw new Error(`Upload failed: ${error.message}`);
        }
    }

    /**
     * Get job status
     */
    async getJobStatus(jobId) {
        try {
            const response = await this.axios.get(`/api/audio/status/${jobId}`);
            return response.data;
        } catch (error) {
            if (error.response && error.response.status === 404) {
                throw new Error(`Job not found: ${jobId}`);
            }
            throw new Error(`Failed to get job status: ${error.message}`);
        }
    }

    /**
     * Download separated stem
     */
    async downloadStem(jobId, stemName, outputPath) {
        try {
            const response = await this.axios.get(`/api/audio/download/${jobId}/${stemName}`, {
                responseType: 'stream'
            });

            // Ensure output directory exists
            const outputDir = path.dirname(outputPath);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            // Save file
            const writer = fs.createWriteStream(outputPath);
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    console.log(`💾 Downloaded: ${stemName} -> ${outputPath}`);
                    resolve(outputPath);
                });
                writer.on('error', reject);
            });
        } catch (error) {
            if (error.response && error.response.status === 404) {
                throw new Error(`Stem not found: ${stemName} for job ${jobId}`);
            }
            throw new Error(`Download failed: ${error.message}`);
        }
    }

    /**
     * Wait for job completion with progress updates
     */
    async waitForCompletion(jobId, onProgress = null) {
        const checkInterval = 2000; // Check every 2 seconds
        const maxWaitTime = 600000; // 10 minutes max
        const startTime = Date.now();

        while (true) {
            if (Date.now() - startTime > maxWaitTime) {
                throw new Error('Job timeout: Processing took too long');
            }

            const status = await this.getJobStatus(jobId);
            
            if (onProgress) {
                onProgress(status.job);
            }

            if (status.job.status === 'completed') {
                return status.job;
            } else if (status.job.status === 'failed') {
                throw new Error(`Job failed: ${status.job.error}`);
            }

            // Wait before next check
            await new Promise(resolve => setTimeout(resolve, checkInterval));
        }
    }

    /**
     * Complete workflow: upload, process, and download all stems
     */
    async processAudio(audioFilePath, outputDir, options = {}) {
        try {
            console.log('🎵 Starting audio stem separation...');
            
            // Step 1: Upload and start processing
            const uploadResult = await this.separateStems(audioFilePath, options);
            const jobId = uploadResult.jobId;
            
            console.log(`🚀 Job started: ${jobId}`);
            console.log(`⏱️ Estimated time: ${uploadResult.estimatedTime}s`);

            // Step 2: Wait for completion with progress updates
            const job = await this.waitForCompletion(jobId, (jobStatus) => {
                process.stdout.write(`\r📊 Progress: ${jobStatus.progress}% - ${jobStatus.status}`);
            });

            console.log('\n✅ Processing completed!');
            console.log(`⏱️ Total time: ${job.processingTime}s`);

            // Step 3: Download all stems
            const downloadPromises = [];
            
            if (job.downloadUrls) {
                Object.keys(job.downloadUrls).forEach(stemName => {
                    const outputPath = path.join(outputDir, `${stemName}.${options.format || 'wav'}`);
                    downloadPromises.push(this.downloadStem(jobId, stemName, outputPath));
                });
            }

            const downloadedFiles = await Promise.all(downloadPromises);
            
            console.log('🎉 All stems downloaded successfully!');
            return {
                jobId,
                processingTime: job.processingTime,
                downloadedFiles,
                job
            };

        } catch (error) {
            console.error('❌ Error:', error.message);
            throw error;
        }
    }
}

// Example usage
async function example() {
    try {
        const client = new StemSeparationClient('http://localhost:3000');
        
        // Check if API is available
        console.log('🏥 Checking API health...');
        const health = await client.healthCheck();
        console.log(`✅ API Status: ${health.status}`);

        // Get available models
        console.log('🤖 Getting available models...');
        const models = await client.getModels();
        console.log('Available models:', models.models.map(m => m.name).join(', '));

        // Process audio file (replace with your audio file path)
        const audioFile = './test-audio/song.mp3';
        const outputDir = './output-stems';
        
        if (fs.existsSync(audioFile)) {
            const result = await client.processAudio(audioFile, outputDir, {
                model: 'demucs',
                device: 'auto',
                format: 'wav'
            });
            
            console.log('🎵 Processing complete!');
            console.log('Downloaded files:', result.downloadedFiles);
        } else {
            console.log('ℹ️ Example audio file not found. Place an audio file at:', audioFile);
        }

    } catch (error) {
        console.error('💥 Example failed:', error.message);
    }
}

// Run example if this file is executed directly
if (require.main === module) {
    example();
}

module.exports = StemSeparationClient;
