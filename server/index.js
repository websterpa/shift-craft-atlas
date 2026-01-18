const express = require('express');
const path = require('path');
const { ok, fail } = require('./lib/respond');
const { requireAdmin } = require('./lib/auth');
const { rateLimit } = require('./middleware/rateLimit');
const flagsRouter = require('./api/flags');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

// Serve Static Assets (SPA) from public/app
app.use(express.static(path.join(__dirname, '../public/app')));
app.use('/pattern-library', express.static(path.join(__dirname, '../public/pattern-library')));

// Mount Logic Routes
app.use('/api/flags', flagsRouter);
app.use('/api/waitlist', require('./api/waitlist'));
app.use('/api/invites', require('./api/invites'));

// Health Check
app.get('/api/health', (req, res) => {
    ok(res, { status: 'online', timestamp: new Date().toISOString() });
});

// Central Error Handler
app.use((err, req, res, next) => {
    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';
    console.error(`[Server Error] ${message}`);
    fail(res, message, status);
});

// Fallback to index.html for SPA client-side routing
app.get(/(.*)/, (req, res) => {
    const indexPath = path.resolve(__dirname, '../public/app/index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error('SendFile Error:', err);
            if (!res.headersSent) res.status(500).send('Failed to load application');
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
