# 🎵 Stem Separation API

**AI-Powered Audio Stem Separation API for Musicians**  
*Created by Sergie Code - Software Engineer & Programming Educator*

Transform your music production workflow with AI! This Node.js API provides seamless audio stem separation using state-of-the-art machine learning models like Demucs and Open-Unmix.

## ✅ **Current Status: FULLY WORKING** 
- **✅ Node.js API**: Running perfectly on port 3000
- **✅ Python Backend**: All dependencies working (PyTorch 2.8.0+cpu, Demucs)
- **✅ Integration**: Node.js ↔ Python communication working flawlessly
- **✅ File Processing**: Upload → Separation → Download workflow complete
- **✅ Real-time Updates**: WebSocket progress tracking functional
- **✅ All Tests**: API endpoints and file upload verified working

## 🌟 Features

- **🎧 Professional Audio Separation**: Separate vocals, drums, bass, and other instruments
- **🤖 Multiple AI Models**: Support for Demucs, Open-Unmix, and 6-stem models
- **⚡ Real-time Progress**: WebSocket updates for processing status
- **🔒 Production Ready**: Comprehensive error handling, logging, and security
- **📱 RESTful API**: Clean, well-documented endpoints
- **🔄 Asynchronous Processing**: Non-blocking audio processing
- **📊 Job Management**: Track and manage processing jobs
- **🌐 CORS Support**: Ready for web applications
- **🧹 Auto Cleanup**: Automatic file management and cleanup

## 🚀 Quick Start

### Prerequisites

- **Node.js 14+** ✅ (Tested with Node.js 22.15.0)
- **Python 3.8+** ✅ (Tested with Python 3.12.5)
- **Python Virtual Environment** ✅ (Required for dependencies)
- **FFmpeg** ⚠️ (Optional - for advanced audio processing)

### Installation & Setup

#### 1. **Clone and Setup Node.js API**
```bash
git clone https://github.com/sergieCode/stem-separation-api.git
cd stem-separation-api
npm install
```

#### 2. **Setup Python Backend**
The API expects the Python project to be in the same parent directory:
```bash
cd ..
git clone https://github.com/sergieCode/audio-stem-separator.git
cd audio-stem-separator

# Create and activate virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Test the setup
python -m src.main --help
```

#### 3. **Configure Environment Variables**
In the `stem-separation-api` directory, update the `.env` file:
```env
# Windows configuration (example)
PYTHON_PATH=C:\\Users\\YourUser\\Desktop\\IA\\audio-stem-separator\\venv\\Scripts\\python.exe
SEPARATOR_PROJECT_PATH=C:\\Users\\YourUser\\Desktop\\IA\\audio-stem-separator

# macOS/Linux configuration (example)
PYTHON_PATH=/path/to/audio-stem-separator/venv/bin/python
SEPARATOR_PROJECT_PATH=/path/to/audio-stem-separator

# Other settings
DEFAULT_MODEL=demucs
PROCESSING_TIMEOUT=300000
MAX_FILE_SIZE=524288000
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
CORS_ORIGIN=*
```

#### 4. **Start the API**
```bash
cd stem-separation-api
npm start
```

The API will be available at `http://localhost:3000`

### 🧪 **Quick Test**

Test the API with the included test scripts:
```bash
# Test API connectivity
node test-api.js

# Test file upload and processing
node test-upload.js
```

Or use the HTML test client:
```bash
# Open in browser:
file:///path/to/stem-separation-api/examples/test-client.html
```

## 🔧 Verified Configuration

### Working Directory Structure
```
IA/
├── stem-separation-api/          # Node.js API
│   ├── node_modules/
│   ├── examples/
│   │   ├── test-client.html      # ✅ Working HTML test client
│   │   └── node-client.js
│   ├── test-api.js               # ✅ Working API test script
│   ├── test-upload.js            # ✅ Working upload test script
│   ├── .env                      # ✅ Configured with correct paths
│   └── ...
└── audio-stem-separator/         # Python backend
    ├── venv/                     # ✅ Virtual environment with PyTorch 2.8.0+cpu
    ├── src/
    │   └── main.py               # ✅ Working Python script
    ├── requirements.txt          # ✅ All dependencies installed
    └── ...
```

### Verified Python Command Format
```bash
python -m src.main --input "audio.wav" --output "output/" --model demucs --device auto --quiet
```

**Note**: The `--format` argument was removed as it's not supported by the current Python backend.

## ✅ **Testing & Verification**

### Available Test Scripts

1. **API Connectivity Test**
```bash
node test-api.js
```
Expected output:
```
🧪 Testing Stem Separation API...

1️⃣  Testing health endpoint...
✅ Health check: {"status":"healthy","service":"Stem Separation API"...}

2️⃣  Testing models endpoint...
✅ Models available: {
  "models": [
    {"name": "demucs", "description": "Demucs v4 - High quality separation..."},
    {"name": "openunmix", "description": "Open-Unmix - Good quality..."},
    {"name": "demucs_6s", "description": "Demucs 6-stem - Separates 6 instruments..."}
  ]
}

3️⃣  Testing API info endpoint...
✅ API info: {"service":"Stem Separation API","endpoints":{...}}

🎯 Basic API connectivity test completed!
```

2. **File Upload & Processing Test**
```bash
node test-upload.js
```
Expected output:
```
🧪 Testing file upload and stem separation...

🎵 Creating test audio file...
✅ Created test audio file: C:\...\test-files\test-song.wav
� Uploading file for stem separation...
✅ Upload successful!
📊 Response: {
  "success": true,
  "jobId": "15750ac1-0342-46a8-92f8-9ced28cc9a8d",
  "message": "Processing started"
}

📊 Job Status: {
  "status": "completed",
  "progress": 100,
  "processingTime": 2.58,
  "stems": ["drums.wav", "bass.wav", "other.wav", "vocals.wav"]
}
```

3. **HTML Test Client**
Open `examples/test-client.html` in your browser for a full-featured test interface with:
- File upload with drag & drop
- Model selection (Demucs, Open-Unmix, Demucs 6-stem)
- Real-time progress tracking
- Download links for separated stems

### Manual Testing Commands

Test individual endpoints:
```bash
# Health check
curl http://localhost:3000/health

# Available models
curl http://localhost:3000/api/audio/models

# Upload file for processing
curl -X POST http://localhost:3000/api/audio/separate \
  -F "audio=@your-song.mp3" \
  -F "model=demucs" \
  -F "device=auto"

# Check job status (replace {jobId} with actual ID)
curl http://localhost:3000/api/audio/status/{jobId}

# Download separated stem
curl -O http://localhost:3000/api/audio/download/{jobId}/vocals
```

### Python Backend Verification
```bash
cd audio-stem-separator
.\venv\Scripts\activate  # Windows
# source venv/bin/activate  # macOS/Linux

# Test Python dependencies
python -c "import torch, demucs; print('✅ All dependencies working')"

# Test the main script
python -m src.main --help
```

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description | Example |
|----------|---------|-------------|---------|
| `NODE_ENV` | `development` | Environment mode | `production` |
| `PORT` | `3000` | Server port | `3000` |
| `PYTHON_PATH` | `python` | Python executable path | `C:\\...\\venv\\Scripts\\python.exe` |
| `SEPARATOR_PROJECT_PATH` | `../audio-stem-separator` | Path to Python project | `C:\\...\\audio-stem-separator` |
| `DEFAULT_MODEL` | `demucs` | Default AI model | `demucs` |
| `MAX_FILE_SIZE` | `524288000` | Max upload size (500MB) | `524288000` |
| `PROCESSING_TIMEOUT` | `300000` | Processing timeout (5 min) | `300000` |
| `LOG_LEVEL` | `info` | Logging level | `info` |
| `API_KEY` | - | API key for authentication | `your-secure-key` |
| `CORS_ORIGIN` | `*` | CORS allowed origins | `*` |

### Example .env Configuration

#### Windows Setup
```env
NODE_ENV=development
PORT=3000
PYTHON_PATH=C:\\Users\\SnS_D\\Desktop\\IA\\audio-stem-separator\\venv\\Scripts\\python.exe
SEPARATOR_PROJECT_PATH=C:\\Users\\SnS_D\\Desktop\\IA\\audio-stem-separator
DEFAULT_MODEL=demucs
MAX_FILE_SIZE=524288000
PROCESSING_TIMEOUT=300000
LOG_LEVEL=info
CORS_ORIGIN=*
```

#### macOS/Linux Setup
```env
NODE_ENV=development
PORT=3000
PYTHON_PATH=/path/to/audio-stem-separator/venv/bin/python
SEPARATOR_PROJECT_PATH=/path/to/audio-stem-separator
DEFAULT_MODEL=demucs
MAX_FILE_SIZE=524288000
PROCESSING_TIMEOUT=300000
LOG_LEVEL=info
CORS_ORIGIN=*
```

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication
For production use, include your API key:
```bash
# Header method
curl -H "X-API-Key: your-api-key" [endpoint]

# Query parameter method
curl "[endpoint]?apiKey=your-api-key"
```

### Endpoints

#### 🏥 Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "Stem Separation API",
  "version": "1.0.0",
  "message": "Service is ready",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "author": "Sergie Code"
}
```

#### 🎯 Get Available Models
```http
GET /api/audio/models
```

**Response:**
```json
{
  "success": true,
  "models": [
    {
      "name": "demucs",
      "description": "Demucs v4 - High quality separation",
      "stems": ["vocals", "drums", "bass", "other"],
      "default": true
    }
  ],
  "defaultModel": "demucs",
  "supportedDevices": ["auto", "cpu", "cuda"],
  "supportedFormats": ["wav", "flac", "mp3"]
}
```

#### 🎵 Separate Audio Stems
```http
POST /api/audio/separate
```

**Request:**
- **Content-Type:** `multipart/form-data`
- **Body:**
  - `audio` (file): Audio file to process
  - `model` (string, optional): AI model to use (`demucs`, `openunmix`)
  - `device` (string, optional): Processing device (`auto`, `cpu`, `cuda`)

**Note**: The `format` parameter has been removed as it's not supported by the current Python backend.

**Example:**
```bash
curl -X POST http://localhost:3000/api/audio/separate \
  -F "audio=@song.mp3" \
  -F "model=demucs" \
  -F "device=auto"
```

**Response:**
```json
{
  "success": true,
  "jobId": "123e4567-e89b-12d3-a456-426614174000",
  "message": "Processing started",
  "estimatedTime": 120,
  "statusUrl": "/api/audio/status/123e4567-e89b-12d3-a456-426614174000",
  "websocketEvent": "job-123e4567-e89b-12d3-a456-426614174000",
  "downloadUrlPattern": "/api/audio/download/123e4567-e89b-12d3-a456-426614174000/{stem}"
}
```

#### 📊 Check Job Status
```http
GET /api/audio/status/:jobId
```

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "status": "completed",
    "progress": 100,
    "inputFile": "song.mp3",
    "model": "demucs",
    "startTime": "2024-01-15T10:30:00.000Z",
    "endTime": "2024-01-15T10:32:30.000Z",
    "processingTime": 150,
    "downloadUrls": {
      "vocals": "/api/audio/download/123.../vocals",
      "drums": "/api/audio/download/123.../drums",
      "bass": "/api/audio/download/123.../bass",
      "other": "/api/audio/download/123.../other"
    }
  }
}
```

#### 💾 Download Separated Stem
```http
GET /api/audio/download/:jobId/:stem
```

**Parameters:**
- `jobId`: Job UUID
- `stem`: Stem name (`vocals`, `drums`, `bass`, `other`)

**Example:**
```bash
curl -O http://localhost:3000/api/audio/download/123e4567-e89b-12d3-a456-426614174000/vocals
```

#### 📝 Get Recent Jobs
```http
GET /api/audio/jobs?limit=50
```

**Response:**
```json
{
  "success": true,
  "jobs": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "status": "completed",
      "inputFile": "song.mp3",
      "model": "demucs",
      "startTime": "2024-01-15T10:30:00.000Z",
      "processingTime": 150
    }
  ],
  "total": 1
}
```

## 🔌 WebSocket Integration

Subscribe to real-time job updates:

```javascript
const socket = io('http://localhost:3000');

// Subscribe to job updates
socket.emit('subscribe-job', jobId);

// Listen for updates
socket.on('job-update', (data) => {
  console.log(`Job ${data.jobId}: ${data.status} (${data.progress}%)`);
  
  if (data.status === 'completed') {
    console.log('Download URLs:', data.result.downloadUrls);
  }
});
```

## 🔗 Integration with Python Backend

This API integrates seamlessly with the [audio-stem-separator](https://github.com/sergieCode/audio-stem-separator) Python project. The integration follows the patterns described in the `nodejs-instructions.md` guide:

### How It Works

1. **File Upload**: Audio files are uploaded to the Node.js API
2. **Job Creation**: A unique job ID is created and the job is queued
3. **Python Processing**: The API calls the Python backend using child processes
4. **Real-time Updates**: Progress is tracked and broadcast via WebSockets
5. **File Delivery**: Separated stems are made available for download

### Python Backend Requirements

Ensure your Python backend supports the following command structure:
```bash
python -m src.main --input "audio.mp3" --output "output/" --model demucs --device auto --format wav
```

Expected JSON response format:
```json
{
  "success": true,
  "input_file": "C:\\...\\audio.wav",
  "output_folder": "C:\\...\\output",
  "model_used": "demucs",
  "processing_time": 2.58,
  "stems": ["drums.wav", "bass.wav", "other.wav", "vocals.wav"],
  "files": {
    "drums.wav": {"exists": true, "size": 1024, "path": "..."},
    "bass.wav": {"exists": true, "size": 1024, "path": "..."},
    "other.wav": {"exists": true, "size": 1024, "path": "..."},
    "vocals.wav": {"exists": true, "size": 1024, "path": "..."}
  }
}
```

### Integration Command Structure
The API calls the Python backend using this command format:
```bash
python -m src.main --input "audio.wav" --output "output/" --model demucs --device auto --quiet
```

**Important**: The `--format` parameter was removed from the command as it's not supported by the current Python backend version.

## 🖥️ Frontend Integration Examples

### HTML + JavaScript

```html
<!DOCTYPE html>
<html>
<head>
    <title>Stem Separator</title>
    <script src="/socket.io/socket.io.js"></script>
</head>
<body>
    <form id="uploadForm" enctype="multipart/form-data">
        <input type="file" id="audioFile" accept="audio/*" required>
        <select id="model">
            <option value="demucs">Demucs (High Quality)</option>
            <option value="openunmix">Open-Unmix (Fast)</option>
        </select>
        <button type="submit">Separate Stems</button>
    </form>
    
    <div id="status"></div>
    <div id="results"></div>

    <script>
        const socket = io();
        const form = document.getElementById('uploadForm');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData();
            formData.append('audio', document.getElementById('audioFile').files[0]);
            formData.append('model', document.getElementById('model').value);

            const response = await fetch('/api/audio/separate', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            if (result.success) {
                socket.emit('subscribe-job', result.jobId);
                document.getElementById('status').innerHTML = 
                    `Processing started... Estimated time: ${result.estimatedTime}s`;
            }
        });

        socket.on('job-update', (data) => {
            const statusDiv = document.getElementById('status');
            statusDiv.innerHTML = `Status: ${data.status} (${data.progress}%)`;

            if (data.status === 'completed') {
                const resultsDiv = document.getElementById('results');
                resultsDiv.innerHTML = '<h3>Download Stems:</h3>';
                
                Object.keys(data.result.downloadUrls).forEach(stem => {
                    resultsDiv.innerHTML += 
                        `<a href="${data.result.downloadUrls[stem]}" download>
                            Download ${stem}.wav
                        </a><br>`;
                });
            }
        });
    </script>
</body>
</html>
```

### React Component

```jsx
import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const StemSeparator = () => {
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState('');
    const [progress, setProgress] = useState(0);
    const [results, setResults] = useState(null);
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        const newSocket = io('http://localhost:3000');
        setSocket(newSocket);

        newSocket.on('job-update', (data) => {
            setStatus(data.status);
            setProgress(data.progress);
            
            if (data.status === 'completed') {
                setResults(data.result);
            }
        });

        return () => newSocket.close();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const formData = new FormData();
        formData.append('audio', file);
        formData.append('model', 'demucs');

        try {
            const response = await fetch('/api/audio/separate', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            if (result.success) {
                socket.emit('subscribe-job', result.jobId);
                setStatus('processing');
            }
        } catch (error) {
            console.error('Upload failed:', error);
        }
    };

    return (
        <div>
            <form onSubmit={handleSubmit}>
                <input 
                    type="file" 
                    accept="audio/*"
                    onChange={(e) => setFile(e.target.files[0])}
                    required 
                />
                <button type="submit">Separate Stems</button>
            </form>

            {status && (
                <div>
                    <p>Status: {status}</p>
                    <progress value={progress} max={100}>{progress}%</progress>
                </div>
            )}

            {results && (
                <div>
                    <h3>Download Stems:</h3>
                    {Object.entries(results.downloadUrls).map(([stem, url]) => (
                        <a key={stem} href={url} download>
                            Download {stem}.wav
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
};

export default StemSeparator;
```

## 🐳 Docker Deployment

### Dockerfile

```dockerfile
FROM node:18-slim

# Install Python and system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install Node.js dependencies
COPY package*.json ./
RUN npm ci --only=production

# Clone and setup Python backend
RUN git clone https://github.com/sergieCode/audio-stem-separator.git
RUN cd audio-stem-separator && pip3 install -r requirements.txt

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p uploads outputs logs temp

# Set environment variables
ENV NODE_ENV=production
ENV SEPARATOR_PROJECT_PATH=/app/audio-stem-separator
ENV PYTHON_PATH=python3

EXPOSE 3000

CMD ["node", "index.js"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  stem-api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PYTHON_PATH=python3
      - SEPARATOR_PROJECT_PATH=/app/audio-stem-separator
    volumes:
      - ./uploads:/app/uploads
      - ./outputs:/app/outputs
      - ./logs:/app/logs
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - stem-api
    restart: unless-stopped
```

## 🔒 Security Considerations

### Production Checklist

- [ ] Set strong `API_KEY` in environment variables
- [ ] Configure proper CORS origins (avoid `*` in production)
- [ ] Enable HTTPS with SSL certificates
- [ ] Implement rate limiting for API endpoints
- [ ] Set up proper firewall rules
- [ ] Use secure file upload validation
- [ ] Enable request logging and monitoring
- [ ] Configure proper backup strategies

### Security Headers

The API automatically includes security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (in production)

## 📊 Monitoring and Logging

### Log Files

- `logs/combined.log` - All application logs
- `logs/error.log` - Error logs only
- Console output in development mode

### Log Levels

- `error`: System errors and failures
- `warn`: Warning messages and issues
- `info`: General information and API usage
- `debug`: Detailed debugging information

### Performance Monitoring

Monitor these metrics:
- Processing time per file
- Queue length and processing capacity
- Disk space usage
- Memory consumption
- Error rates

## 🧪 Testing

Run the test suite:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

### Test Coverage

The test suite covers:
- API endpoint functionality
- File upload validation
- Error handling
- Authentication (when enabled)
- WebSocket connections

## 🔧 Troubleshooting

### Common Issues & Solutions

**1. Python backend not found**
```
Error: Cannot read properties of undefined (reading 'stemService')
Solution: 
- Check PYTHON_PATH points to the virtual environment Python executable
- Verify SEPARATOR_PROJECT_PATH points to the audio-stem-separator directory
- Ensure both projects are in the correct directory structure
```

**2. PyTorch/Dependencies not found**
```
Error: ModuleNotFoundError: No module named 'torch'
Solution:
- Activate the Python virtual environment
- Reinstall dependencies: pip install -r requirements.txt
- Verify: python -c "import torch; print('PyTorch available')"
```

**3. Command argument errors**
```
Error: main.py: error: unrecognized arguments: --format wav
Solution:
- This is expected - the --format argument was removed from the API
- The Python backend outputs in WAV format by default
```

**4. File upload fails**
```
Error: File too large or invalid format
Solution: 
- Check MAX_FILE_SIZE setting (default 500MB)
- Ensure file is a valid audio format (MP3, WAV, FLAC)
- Check available disk space
```

**5. Processing timeout**
```
Error: Processing timeout exceeded
Solution: 
- Increase PROCESSING_TIMEOUT for larger files
- Use faster model (openunmix instead of demucs)
- Ensure adequate system resources
```

**6. WebSocket connection issues**
```
Error: Socket.IO connection failed
Solution: 
- Verify CORS configuration allows your domain
- Check firewall settings
- Ensure WebSocket support in browser/client
```

### System Requirements Check
Run the built-in system check:
```bash
node setup-check.js
```

Expected output:
```
🔍 Checking system requirements...

✅ Node.js: 22.15.0 (required: 14.0.0+)
✅ Python: 3.12.5 (required: 3.8.0+)
⚠️ FFmpeg: Not found (optional for advanced features)
📁 Disk space: Available (recommended: 5GB+ free)
```

### Debug Mode

Enable detailed logging:
```bash
LOG_LEVEL=debug npm run dev
```

### Health Check Endpoints

Monitor service health:
```bash
# Basic health check
curl http://localhost:3000/health

# Detailed service info  
curl http://localhost:3000/api

# Check available models
curl http://localhost:3000/api/audio/models
```

### Verified Working Configuration

**Directory Structure** (Windows example):
```
C:\Users\SnS_D\Desktop\IA\
├── stem-separation-api\          # Node.js API ✅ Working
│   ├── .env                      # ✅ Configured correctly
│   ├── test-api.js               # ✅ All tests pass
│   └── test-upload.js            # ✅ Upload working
└── audio-stem-separator\         # Python backend ✅ Working
    ├── venv\Scripts\python.exe   # ✅ PyTorch 2.8.0+cpu
    └── src\main.py               # ✅ Command structure verified
```

**Working .env Configuration**:
```env
PYTHON_PATH=C:\\Users\\SnS_D\\Desktop\\IA\\audio-stem-separator\\venv\\Scripts\\python.exe
SEPARATOR_PROJECT_PATH=C:\\Users\\SnS_D\\Desktop\\IA\\audio-stem-separator
DEFAULT_MODEL=demucs
# ... other settings
```

## 🚀 Performance Optimization

### Production Tips

1. **Use PM2 for process management**
```bash
npm install -g pm2
pm2 start ecosystem.config.js
```

2. **Enable gzip compression**
```javascript
app.use(compression());
```

3. **Set up reverse proxy with Nginx**
4. **Use Redis for job storage** (instead of in-memory Map)
5. **Implement job queues** for high-load scenarios
6. **Use CDN** for static file serving

### Scaling Considerations

- **Horizontal scaling**: Multiple API instances with shared Redis
- **Load balancing**: Distribute requests across instances
- **File storage**: Use cloud storage (AWS S3, Google Cloud)
- **Processing queue**: Use Redis Bull or AWS SQS

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

### Development Setup

```bash
git clone https://github.com/sergieCode/stem-separation-api.git
cd stem-separation-api
npm install
npm run dev
```

## 👨‍💻 About Sergie Code

I'm a passionate software engineer and programming educator who creates AI tools for musicians and developers. 

- 📸 Instagram: https://www.instagram.com/sergiecode

- 🧑🏼‍💻 LinkedIn: https://www.linkedin.com/in/sergiecode/

- 📽️Youtube: https://www.youtube.com/@SergieCode

- 😺 Github: https://github.com/sergiecode

- 👤 Facebook: https://www.facebook.com/sergiecodeok

- 🎞️ Tiktok: https://www.tiktok.com/@sergiecode

- 🕊️Twitter: https://twitter.com/sergiecode

- 🧵Threads: https://www.threads.net/@sergiecode



### Other Projects

Check out my other AI tools for musicians:
- [Audio Stem Separator](https://github.com/sergieCode/audio-stem-separator) - Python backend
- [Audio Engancer Service](https://github.com/sergiecode/audio-enhancer-service) - Python backend

## 🌟 Support the Project

If this API helps your music production workflow:

- ⭐ Star the repository
- 🐛 Report bugs and issues
- 💡 Suggest new features
- 📢 Share with other musicians

---

**Made with ❤️ for the music community by Sergie Code**

*Empowering musicians with AI technology, one API at a time.*

