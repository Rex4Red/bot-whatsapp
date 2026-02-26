require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');

const whatsapp = require('./services/whatsapp');
const messageRoutes = require('./routes/messages');
const statusRoutes = require('./routes/status');
const contactRoutes = require('./routes/contacts');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve static dashboard in production
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// API Routes
app.use('/api', messageRoutes);
app.use('/api', statusRoutes);
app.use('/api/contacts', contactRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Bot WhatsApp is running', timestamp: new Date().toISOString() });
});

// Fallback to dashboard for SPA
app.get('/{*splat}', (req, res) => {
    const indexPath = path.join(publicPath, 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            res.status(404).json({ error: 'Not found' });
        }
    });
});

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('[Socket.IO] Dashboard connected');

    // Send current status and QR on connect
    socket.emit('status', whatsapp.getStatus());
    const qr = whatsapp.getQrCode();
    if (qr) {
        socket.emit('qr', qr);
    }

    socket.on('disconnect', () => {
        console.log('[Socket.IO] Dashboard disconnected');
    });
});

// Start server
const PORT = process.env.PORT || 3005;

server.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  🤖 Bot WhatsApp Notification System`);
    console.log(`  🌐 Server: http://localhost:${PORT}`);
    console.log(`  📊 Dashboard: http://localhost:${PORT}`);
    console.log(`  📡 API: http://localhost:${PORT}/api`);
    console.log(`========================================\n`);

    // Initialize WhatsApp after server starts
    whatsapp.initialize(io);
});
