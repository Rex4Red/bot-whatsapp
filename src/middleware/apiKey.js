require('dotenv').config();

function apiKeyAuth(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    const validKey = process.env.API_KEY;

    // Allow dashboard requests and valid API key requests
    if (apiKey === 'dashboard' || apiKey === validKey) {
        return next();
    }

    return res.status(401).json({
        success: false,
        error: 'Unauthorized — invalid or missing API key',
    });
}

module.exports = { apiKeyAuth };
