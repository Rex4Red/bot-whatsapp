const express = require('express');
const router = express.Router();
const whatsapp = require('../services/whatsapp');

// Get WhatsApp connection status
router.get('/status', (req, res) => {
    try {
        const status = whatsapp.getStatus();
        const qr = whatsapp.getQrCode();

        return res.json({
            success: true,
            data: {
                ...status,
                hasQrCode: !!qr,
            },
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: err.message,
        });
    }
});

// Get QR code
router.get('/qr', (req, res) => {
    try {
        const qr = whatsapp.getQrCode();

        return res.json({
            success: true,
            data: { qr },
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: err.message,
        });
    }
});

// Restart WhatsApp client
router.post('/restart', async (req, res) => {
    try {
        await whatsapp.restart();
        return res.json({
            success: true,
            message: 'WhatsApp client is restarting...',
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: err.message,
        });
    }
});

// Logout WhatsApp session
router.post('/logout', async (req, res) => {
    try {
        await whatsapp.logout();
        return res.json({
            success: true,
            message: 'Logged out. Please scan QR code again.',
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: err.message,
        });
    }
});

module.exports = router;
