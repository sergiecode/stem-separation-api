FROM node:18-slim

LABEL maintainer="Sergie Code <sergiecodeteach@gmail.com>"
LABEL description="AI-powered audio stem separation API"

# Install Python and system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production && npm cache clean --force

# Create application user
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Clone and setup Python backend
RUN git clone https://github.com/sergieCode/audio-stem-separator.git && \
    cd audio-stem-separator && \
    pip3 install -r requirements.txt

# Copy application code
COPY . .

# Create necessary directories with proper permissions
RUN mkdir -p uploads outputs logs temp && \
    chown -R appuser:appuser /app

# Set environment variables
ENV NODE_ENV=production
ENV SEPARATOR_PROJECT_PATH=/app/audio-stem-separator
ENV PYTHON_PATH=python3
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Switch to non-root user
USER appuser

# Start the application
CMD ["node", "index.js"]
