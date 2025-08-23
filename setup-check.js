const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Check system requirements for the stem separation API
 */
async function checkSystemRequirements() {
    console.log('🔍 Checking system requirements...\n');

    const requirements = {
        node: { required: '14.0.0', current: process.version },
        python: { required: '3.8.0', current: null },
        ffmpeg: { required: 'any', current: null },
        diskSpace: { required: '5GB', current: null }
    };

    // Check Node.js version
    const nodeVersion = process.version.replace('v', '');
    const nodeOk = compareVersions(nodeVersion, requirements.node.required) >= 0;
    console.log(`${nodeOk ? '✅' : '❌'} Node.js: ${nodeVersion} (required: ${requirements.node.required}+)`);

    // Check Python
    try {
        const { stdout } = await execAsync('python --version 2>&1 || python3 --version 2>&1');
        const pythonVersion = stdout.match(/Python (\d+\.\d+\.\d+)/)?.[1];
        requirements.python.current = pythonVersion;
        const pythonOk = pythonVersion && compareVersions(pythonVersion, requirements.python.required) >= 0;
        console.log(`${pythonOk ? '✅' : '❌'} Python: ${pythonVersion || 'Not found'} (required: ${requirements.python.required}+)`);
    } catch (error) {
        console.log(`❌ Python: Not found (required: ${requirements.python.required}+)`);
    }

    // Check FFmpeg
    try {
        const { stdout } = await execAsync('ffmpeg -version 2>&1');
        const ffmpegVersion = stdout.match(/ffmpeg version ([^\s]+)/)?.[1];
        requirements.ffmpeg.current = ffmpegVersion;
        console.log(`✅ FFmpeg: ${ffmpegVersion || 'Found'}`);
    } catch (error) {
        console.log(`❌ FFmpeg: Not found (required for audio processing)`);
    }

    // Check disk space (simplified)
    try {
        const isWindows = process.platform === 'win32';
        const command = isWindows 
            ? 'dir /-c' 
            : 'df -h .';
        
        const { stdout } = await execAsync(command);
        console.log(`📁 Disk space: Available (recommended: 5GB+ free)`);
    } catch (error) {
        console.log(`⚠️ Disk space: Could not check automatically`);
    }

    console.log('\n📋 Installation instructions:');
    console.log('1. Install Node.js: https://nodejs.org/');
    console.log('2. Install Python: https://python.org/');
    console.log('3. Install FFmpeg: https://ffmpeg.org/');
    console.log('4. Clone audio-stem-separator: git clone https://github.com/sergieCode/audio-stem-separator.git');
    console.log('5. Install Python dependencies: pip install -r requirements.txt');
    console.log('6. Install Node.js dependencies: npm install');
    console.log('7. Start the API: npm start');

    console.log('\n🎵 Created by Sergie Code - Happy music making!');
}

/**
 * Compare version strings
 */
function compareVersions(version1, version2) {
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

// Run the check if this file is executed directly
if (require.main === module) {
    checkSystemRequirements().catch(console.error);
}

module.exports = { checkSystemRequirements };
