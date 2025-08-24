// Simple test script for the Stem Separation API
const axios = require('axios');

const API_BASE = 'http://localhost:3000';

async function testAPI() {
    console.log('🧪 Testing Stem Separation API...\n');

    try {
        // Test health endpoint
        console.log('1️⃣  Testing health endpoint...');
        const healthResponse = await axios.get(`${API_BASE}/health`);
        console.log('✅ Health check:', healthResponse.data);
        console.log('');

        // Test models endpoint
        console.log('2️⃣  Testing models endpoint...');
        try {
            const modelsResponse = await axios.get(`${API_BASE}/api/audio/models`);
            console.log('✅ Models available:', modelsResponse.data);
        } catch (error) {
            console.log('❌ Models endpoint error:', error.response?.data || error.message);
        }
        console.log('');

        // Test API info endpoint (if available)
        console.log('3️⃣  Testing API info endpoint...');
        try {
            const apiResponse = await axios.get(`${API_BASE}/api`);
            console.log('✅ API info:', apiResponse.data);
        } catch (error) {
            console.log('❌ API info endpoint error:', error.response?.data || error.message);
        }
        console.log('');

        console.log('🎯 Basic API connectivity test completed!');
        console.log('📝 To test file upload, use the HTML test client or upload an audio file via POST to /api/audio/separate');

    } catch (error) {
        console.error('❌ API test failed:', error.message);
        console.error('💡 Make sure the server is running on port 3000');
    }
}

// Run the test
testAPI();
