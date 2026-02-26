const express = require('express');
const router = express.Router();
const { getAllContacts, insertContact, deleteContact, getContactById } = require('../services/database');

// Get all contacts
router.get('/', (req, res) => {
    try {
        const group = req.query.group || null;
        const contacts = getAllContacts(group);

        return res.json({
            success: true,
            data: contacts,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: err.message,
        });
    }
});

// Add new contact
router.post('/', (req, res) => {
    try {
        const { name, phone_number, group_name } = req.body;

        if (!name || !phone_number) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: name, phone_number',
            });
        }

        const result = insertContact.run({
            name,
            phone_number,
            group_name: group_name || 'default',
        });

        return res.json({
            success: true,
            data: { id: result.lastInsertRowid, name, phone_number, group_name: group_name || 'default' },
        });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint')) {
            return res.status(409).json({
                success: false,
                error: 'Phone number already exists in contacts',
            });
        }
        return res.status(500).json({
            success: false,
            error: err.message,
        });
    }
});

// Delete contact
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const contact = getContactById.get(id);

        if (!contact) {
            return res.status(404).json({
                success: false,
                error: 'Contact not found',
            });
        }

        deleteContact.run(id);

        return res.json({
            success: true,
            message: 'Contact deleted',
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: err.message,
        });
    }
});

module.exports = router;
