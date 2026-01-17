const buckets = new Map();

function rateLimit(key, max = 30, windowMs = 60000) {
    const now = Date.now();
    const b = buckets.get(key) || { count: 0, ts: now };

    if (now - b.ts > windowMs) {
        b.count = 0;
        b.ts = now;
    }

    b.count += 1;
    buckets.set(key, b);

    if (b.count > max) {
        const err = new Error("Too many requests");
        err.status = 429;
        throw err;
    }
}

module.exports = { rateLimit };
