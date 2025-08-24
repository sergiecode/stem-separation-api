// Test the stem separation API with a test audio file upload
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3000';

async function createTestAudioFile() {
    console.log('🎵 Creating test audio file...');
    
    // Create a simple test directory
    const testDir = path.join(__dirname, 'test-files');
    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
    }

    // Create a dummy audio file (we'll just create a file with some content)
    // In a real test, you'd use an actual audio file
    const testAudioPath = path.join(testDir, 'test-song.wav');
    
    // Create a simple WAV header (minimal valid WAV file)
    const buffer = Buffer.alloc(1024);
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(1016, 4); // File size - 8
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // Format chunk size
    buffer.writeUInt16LE(1, 20); // Audio format (PCM)
    buffer.writeUInt16LE(2, 22); // Channels
    buffer.writeUInt32LE(44100, 24); // Sample rate
    buffer.writeUInt32LE(176400, 28); // Byte rate
    buffer.writeUInt16LE(4, 32); // Block align
    buffer.writeUInt16LE(16, 34); // Bits per sample
    buffer.write('data', 36);
    buffer.writeUInt32LE(984, 40); // Data chunk size
    
    fs.writeFileSync(testAudioPath, buffer);
    console.log(`✅ Created test audio file: ${testAudioPath}`);
    return testAudioPath;
}

async function testFileUpload() {
    console.log('🧪 Testing file upload and stem separation...\n');

    try {
        // Create test audio file
        const audioFile = await createTestAudioFile();

        // Create form data
        const form = new FormData();
        form.append('audio', fs.createReadStream(audioFile));
        form.append('model', 'demucs');
        form.append('format', 'wav');

        console.log('📤 Uploading file for stem separation...');
        
        // Upload file for processing
        const uploadResponse = await axios.post(`${API_BASE}/api/audio/separate`, form, {
            headers: {
                ...form.getHeaders(),
            },
            timeout: 10000 // 10 second timeout for upload
        });

        console.log('✅ Upload successful!');
        console.log('📊 Response:', uploadResponse.data);

        const jobId = uploadResponse.data.jobId;
        if (jobId) {
            console.log(`\n🔍 Job ID: ${jobId}`);
            console.log('📋 You can check status with: GET /api/audio/status/' + jobId);
            console.log('📥 Download stems with: GET /api/audio/download/' + jobId + '/{stem-name}');
            
            // Check job status
            setTimeout(async () => {
                try {
                    const statusResponse = await axios.get(`${API_BASE}/api/audio/status/${jobId}`);
                    console.log('\n📊 Job Status:', statusResponse.data);
                } catch (error) {
                    console.log('❌ Status check error:', error.response?.data || error.message);
                }
            }, 2000);
        }

    } catch (error) {
        console.error('❌ Upload test failed:', error.response?.data || error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('💡 Make sure the API server is running on port 3000');
        }
    }
}

// Run the test
testFileUpload();
