const express = require('express');
const router = express.Router();
const { apiKeyAuth } = require('../middleware/apiKey');
const whatsapp = require('../services/whatsapp');
const { getMessageLogs, getMessageStats } = require('../services/database');

// Send message to a single number
router.post('/send', apiKeyAuth, async (req, res) => {
    try {
        const { phone, message } = req.body;

        if (!phone || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: phone, message',
            });
        }

        const result = await whatsapp.sendMessage(phone, message);

        return res.json({
            success: true,
            data: result,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: err.message,
        });
    }
});

// Broadcast message to multiple numbers
router.post('/broadcast', apiKeyAuth, async (req, res) => {
    try {
        const { phones, message } = req.body;

        if (!phones || !Array.isArray(phones) || phones.length === 0 || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: phones (array), message',
            });
        }

        const results = await whatsapp.broadcastMessage(phones, message);

        const sent = results.filter((r) => r.status === 'sent').length;
        const failed = results.filter((r) => r.status === 'failed').length;

        return res.json({
            success: true,
            data: {
                total: phones.length,
                sent,
                failed,
                results,
            },
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: err.message,
        });
    }
});

// Get message logs
router.get('/messages', (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const status = req.query.status || null;

        const data = getMessageLogs(page, limit, status);

        return res.json({
            success: true,
            data,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: err.message,
        });
    }
});

// Get message statistics
router.get('/messages/stats', (req, res) => {
    try {
        const stats = getMessageStats();
        return res.json({
            success: true,
            data: stats,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: err.message,
        });
    }
});

// List all WhatsApp groups
router.get('/groups', apiKeyAuth, async (req, res) => {
    try {
        const groups = await whatsapp.getGroups();
        return res.json({
            success: true,
            data: groups,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: err.message,
        });
    }
});

// Send message to a group
router.post('/send-group', apiKeyAuth, async (req, res) => {
    try {
        const { groupId, message } = req.body;

        if (!groupId || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: groupId, message',
            });
        }

        const result = await whatsapp.sendGroupMessage(groupId, message);

        return res.json({
            success: true,
            data: result,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: err.message,
        });
    }
});

// Broadcast message to multiple groups
router.post('/broadcast-group', apiKeyAuth, async (req, res) => {
    try {
        const { groupIds, message } = req.body;

        if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0 || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: groupIds (array), message',
            });
        }

        const results = [];
        for (const groupId of groupIds) {
            try {
                const result = await whatsapp.sendGroupMessage(groupId, message);
                results.push(result);
            } catch (err) {
                results.push({ group: groupId, status: 'failed', error: err.message });
            }
            // Anti-spam delay
            if (groupIds.indexOf(groupId) < groupIds.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }
        }

        const sent = results.filter((r) => r.status === 'sent').length;
        const failed = results.filter((r) => r.status === 'failed').length;

        return res.json({
            success: true,
            data: { total: groupIds.length, sent, failed, results },
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: err.message,
        });
    }
});

module.exports = router;
