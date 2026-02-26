# ---- Stage 1: Build dashboard ----
FROM node:20-slim AS dashboard-builder

WORKDIR /app/dashboard
COPY dashboard/package.json ./
RUN npm install && npm install vite
COPY dashboard/ ./
RUN npx vite build --outDir /app/public

# ---- Stage 2: Production ----
FROM node:20-slim

# Install Chromium dependencies for whatsapp-web.js (Puppeteer)
RUN apt-get update && apt-get install -y \
    chromium \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libnss3 \
    libxss1 \
    libasound2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    fonts-liberation \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV DATA_DIR=/app/data

WORKDIR /app

# Copy package files and install production dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy source code
COPY src/ ./src/

# Copy built dashboard from stage 1
COPY --from=dashboard-builder /app/public ./public/

# Copy env example
COPY .env.example ./.env.example

# Expose port
EXPOSE 3005

# Volume for WhatsApp session persistence & database
VOLUME ["/app/.wwebjs_auth", "/app/data"]

# Create data directory
RUN mkdir -p /app/data

# Start the bot
CMD ["node", "src/index.js"]
