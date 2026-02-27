# ---- Single stage: Production ----
FROM node:20-slim

# Install Chromium and all dependencies for whatsapp-web.js (Puppeteer)
RUN apt-get update && apt-get install -y \
    chromium \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    wget \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV DATA_DIR=/app/data
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copy package files and install production dependencies
COPY package.json package-lock.json ./
RUN npm install --omit=dev

# Copy source code
COPY src/ ./src/

# Copy dashboard files directly as static files (no build step needed)
COPY dashboard/index.html dashboard/style.css dashboard/main.js ./public/

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 3005

# Volume for WhatsApp session persistence & database
VOLUME ["/app/.wwebjs_auth", "/app/data"]

# Start the bot
CMD ["node", "src/index.js"]
