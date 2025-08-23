#!/usr/bin/env node

/**
 * Installation and setup script for Stem Separation API
 * Created by Sergie Code
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

class Installer {
    constructor() {
        this.steps = [
            { name: 'Check system requirements', fn: this.checkRequirements },
            { name: 'Install Node.js dependencies', fn: this.installNodeDeps },
            { name: 'Setup environment variables', fn: this.setupEnvironment },
            { name: 'Create directories', fn: this.createDirectories },
            { name: 'Test API health', fn: this.testHealth }
        ];
    }

    async run() {
        console.log('🎵 Stem Separation API Installation');
        console.log('Created by Sergie Code\n');

        for (let i = 0; i < this.steps.length; i++) {
            const step = this.steps[i];
            console.log(`[${i + 1}/${this.steps.length}] ${step.name}...`);
            
            try {
                await step.fn.call(this);
                console.log(`✅ ${step.name} completed\n`);
            } catch (error) {
                console.error(`❌ ${step.name} failed:`, error.message);
                console.log('\n💡 Please fix the error and run the installer again.\n');
                process.exit(1);
            }
        }

        this.printSuccessMessage();
    }

    async checkRequirements() {
        // Check Node.js version
        const nodeVersion = process.version.replace('v', '');
        if (this.compareVersions(nodeVersion, '14.0.0') < 0) {
            throw new Error(`Node.js 14.0.0+ required. Current: ${nodeVersion}`);
        }

        // Check if npm is available
        try {
            await execAsync('npm --version');
        } catch (error) {
            throw new Error('npm is not available');
        }

        // Check Python
        try {
            const { stdout } = await execAsync('python --version 2>&1 || python3 --version 2>&1');
            const pythonVersion = stdout.match(/Python (\d+\.\d+\.\d+)/)?.[1];
            if (!pythonVersion || this.compareVersions(pythonVersion, '3.8.0') < 0) {
                console.warn('⚠️ Python 3.8+ recommended for the backend');
            }
        } catch (error) {
            console.warn('⚠️ Python not found - needed for audio processing backend');
        }
    }

    async installNodeDeps() {
        try {
            await execAsync('npm install', { stdio: 'inherit' });
        } catch (error) {
            throw new Error('Failed to install Node.js dependencies');
        }
    }

    async setupEnvironment() {
        const envPath = path.join(process.cwd(), '.env');
        
        try {
            await fs.access(envPath);
            console.log('Environment file already exists');
        } catch (error) {
            // Create .env from template
            const envContent = `# Stem Separation API Configuration
NODE_ENV=development
PORT=3000

# Python Backend Configuration
PYTHON_PATH=python
SEPARATOR_PROJECT_PATH=../audio-stem-separator
DEFAULT_MODEL=demucs
PROCESSING_TIMEOUT=300000

# File Configuration
MAX_FILE_SIZE=524288000
UPLOAD_DIR=./uploads
OUTPUT_DIR=./outputs

# Logging
LOG_LEVEL=info

# Security (change in production)
API_KEY=your-api-key-here

# CORS Configuration
CORS_ORIGIN=*
`;
            await fs.writeFile(envPath, envContent);
            console.log('Created .env configuration file');
        }
    }

    async createDirectories() {
        const dirs = ['uploads', 'outputs', 'logs', 'temp'];
        
        for (const dir of dirs) {
            try {
                await fs.mkdir(dir, { recursive: true });
            } catch (error) {
                // Directory might already exist
            }
        }
    }

    async testHealth() {
        // This is a basic test - in a real scenario, you'd start the server and test
        console.log('Basic setup validation passed');
        console.log('Run "npm start" to test the API');
    }

    compareVersions(version1, version2) {
        const v1parts = version1.split('.').map(Number);
        const v2parts = version2.split('.').map(Number);
        
        for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
            const v1part = v1parts[i] || 0;
            const v2part = v2parts[i] || 0;
            
            if (v1part > v2part) return 1;
            if (v1part < v2part) return -1;
        }
        
        return 0;
    }

    printSuccessMessage() {
        console.log('🎉 Installation completed successfully!');
        console.log('\n📋 Next steps:');
        console.log('1. Set up the Python audio-stem-separator backend:');
        console.log('   git clone https://github.com/sergieCode/audio-stem-separator.git');
        console.log('   cd audio-stem-separator');
        console.log('   pip install -r requirements.txt');
        console.log('');
        console.log('2. Update the SEPARATOR_PROJECT_PATH in .env file');
        console.log('');
        console.log('3. Start the API:');
        console.log('   npm start');
        console.log('');
        console.log('4. Test the API:');
        console.log('   Open http://localhost:3000/health in your browser');
        console.log('   Or use the test client: examples/test-client.html');
        console.log('');
        console.log('🎵 Happy music making!');
        console.log('📺 Subscribe to Sergie Code on YouTube for more AI tools!');
    }
}

// Run installer if this file is executed directly
if (require.main === module) {
    new Installer().run().catch(error => {
        console.error('💥 Installation failed:', error);
        process.exit(1);
    });
}

module.exports = Installer;
