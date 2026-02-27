const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { insertMessageLog, updateMessageLog } = require('./database');

// Clean up Chromium lock files left by previous container
// SingletonLock is a SYMLINK, SingletonSocket is a SOCKET — NOT regular files!
function cleanupLockFiles() {
    console.log('[WhatsApp] Cleaning up stale Chromium lock files...');
    try {
        // Remove ALL Singleton* entries (symlinks, sockets, files) anywhere in auth dir
        execSync('find /app/.wwebjs_auth -name "Singleton*" -delete 2>/dev/null || true');
        execSync('find /app/.wwebjs_auth -name "lockfile" -delete 2>/dev/null || true');
        // Also clean from current working directory (in case it differs)
        const cwd = process.cwd();
        if (cwd !== '/app') {
            execSync(`find ${cwd}/.wwebjs_auth -name "Singleton*" -delete 2>/dev/null || true`);
            execSync(`find ${cwd}/.wwebjs_auth -name "lockfile" -delete 2>/dev/null || true`);
        }
        console.log('[WhatsApp] Lock file cleanup completed');
    } catch (err) {
        console.log('[WhatsApp] Lock file cleanup skipped (no auth dir yet)');
    }
}

let client = null;
let io = null;
let connectionStatus = 'disconnected';
let qrCodeData = null;

const SEND_DELAY_MS = 2000; // 2 second delay between messages (anti-spam)

function getStatus() {
    return {
        status: connectionStatus,
        uptime: client ? process.uptime() : 0,
    };
}

function getQrCode() {
    return qrCodeData;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatPhoneNumber(phone) {
    // Remove any non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    // Ensure it starts with country code (assume Indonesia 62 if starts with 0)
    if (cleaned.startsWith('0')) {
        cleaned = '62' + cleaned.slice(1);
    }
    // WhatsApp format: number@c.us
    return cleaned + '@c.us';
}

async function initialize(socketIO) {
    io = socketIO;

    // Remove stale Chromium lock files from previous container
    cleanupLockFiles();

    const puppeteerConfig = {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--disable-gpu',
            '--single-process',
            '--no-zygote',
            '--disable-extensions',
        ],
    };

    // Use system Chromium in Docker
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        puppeteerConfig.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
        console.log('[WhatsApp] Using Chromium at:', process.env.PUPPETEER_EXECUTABLE_PATH);
    }

    console.log('[WhatsApp] Initializing client...');

    client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: puppeteerConfig,
    });

    client.on('qr', async (qr) => {
        connectionStatus = 'waiting_qr';
        try {
            qrCodeData = await qrcode.toDataURL(qr);
            io.emit('qr', qrCodeData);
            io.emit('status', getStatus());
            console.log('[WhatsApp] QR code generated — scan with your phone');
        } catch (err) {
            console.error('[WhatsApp] QR generation error:', err);
        }
    });

    client.on('ready', () => {
        connectionStatus = 'connected';
        qrCodeData = null;
        io.emit('status', getStatus());
        io.emit('qr', null);
        console.log('[WhatsApp] Client is ready!');
    });

    client.on('authenticated', () => {
        connectionStatus = 'authenticated';
        io.emit('status', getStatus());
        console.log('[WhatsApp] Authenticated successfully');
    });

    client.on('auth_failure', (msg) => {
        connectionStatus = 'auth_failure';
        io.emit('status', getStatus());
        console.error('[WhatsApp] Authentication failed:', msg);
    });

    client.on('disconnected', (reason) => {
        connectionStatus = 'disconnected';
        io.emit('status', getStatus());
        console.log('[WhatsApp] Disconnected:', reason);
    });

    const MAX_RETRIES = 5;
    const RETRY_DELAY = 10000; // 10 seconds

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`[WhatsApp] Initialization attempt ${attempt}/${MAX_RETRIES}...`);
            await client.initialize();
            break; // success
        } catch (err) {
            connectionStatus = 'error';
            io.emit('status', getStatus());
            console.error(`[WhatsApp] Initialization error (attempt ${attempt}/${MAX_RETRIES}):`, err.message);

            if (attempt < MAX_RETRIES) {
                console.log(`[WhatsApp] Retrying in ${RETRY_DELAY / 1000} seconds...`);
                await sleep(RETRY_DELAY);
                // Cleanup before retry
                cleanupLockFiles();
            } else {
                console.error('[WhatsApp] All retry attempts failed. Please restart the container.');
            }
        }
    }
}

async function sendMessage(phone, message) {
    if (connectionStatus !== 'connected') {
        throw new Error('WhatsApp is not connected');
    }

    const chatId = formatPhoneNumber(phone);

    // Log the attempt
    const logEntry = insertMessageLog.run({
        phone_number: phone,
        message: message,
        status: 'pending',
        error: null,
        type: 'single',
    });

    try {
        // Check if number is registered on WhatsApp
        const isRegistered = await client.isRegisteredUser(chatId);
        if (!isRegistered) {
            throw new Error(`Number ${phone} is not registered on WhatsApp`);
        }

        await client.sendMessage(chatId, message);

        updateMessageLog.run({
            id: logEntry.lastInsertRowid,
            status: 'sent',
            error: null,
        });

        io.emit('message_sent', { id: logEntry.lastInsertRowid, phone, status: 'sent' });

        return { id: logEntry.lastInsertRowid, status: 'sent' };
    } catch (err) {
        updateMessageLog.run({
            id: logEntry.lastInsertRowid,
            status: 'failed',
            error: err.message,
        });

        io.emit('message_sent', {
            id: logEntry.lastInsertRowid,
            phone,
            status: 'failed',
            error: err.message,
        });

        throw err;
    }
}

async function broadcastMessage(phones, message) {
    if (connectionStatus !== 'connected') {
        throw new Error('WhatsApp is not connected');
    }

    const results = [];

    for (let i = 0; i < phones.length; i++) {
        const phone = phones[i];
        try {
            const result = await sendMessage(phone, message);
            results.push({ phone, ...result });
        } catch (err) {
            results.push({ phone, status: 'failed', error: err.message });
        }

        // Delay between messages to avoid spam detection
        if (i < phones.length - 1) {
            await sleep(SEND_DELAY_MS);
        }
    }

    return results;
}

async function restart() {
    console.log('[WhatsApp] Restarting client...');
    connectionStatus = 'restarting';
    io.emit('status', getStatus());

    try {
        if (client) {
            await client.destroy();
        }
        await initialize(io);
    } catch (err) {
        console.error('[WhatsApp] Restart error:', err.message);
        connectionStatus = 'error';
        io.emit('status', getStatus());
    }
}

async function logout() {
    console.log('[WhatsApp] Logging out...');
    try {
        if (client) {
            await client.logout();
            await client.destroy();
        }
        connectionStatus = 'disconnected';
        io.emit('status', getStatus());
        // Re-initialize to show QR code again
        await initialize(io);
    } catch (err) {
        console.error('[WhatsApp] Logout error:', err.message);
        connectionStatus = 'error';
        io.emit('status', getStatus());
    }
}

module.exports = {
    initialize,
    sendMessage,
    broadcastMessage,
    getStatus,
    getQrCode,
    restart,
    logout,
};
