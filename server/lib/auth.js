const ADMIN_SECRET = process.env.ADMIN_SECRET || 'secret_admin_token_123';

if (!process.env.ADMIN_SECRET) {
    console.warn('[Security] ADMIN_SECRET not set. Using default: ' + ADMIN_SECRET);
}

async function requireAdmin(req) {
    const auth = req.headers['authorization'];
    if (!auth) authFailed();

    const token = auth.replace('Bearer ', '').trim();

    // Simple strict equality check (Use timingSafeEqual in prod)
    if (token !== ADMIN_SECRET) {
        authFailed();
    }

    return 'admin_user'; // Identify actor
}

function authFailed() {
    const err = new Error("Unauthorized: Admin Access Required");
    err.status = 401;
    throw err;
}

module.exports = { requireAdmin };
