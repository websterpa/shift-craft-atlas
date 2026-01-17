const express = require('express');
const { z } = require('zod');
const { supabase } = require('../lib/supabase');
const { validate } = require('../lib/validate');
const { ok, fail } = require('../lib/respond');
const { rateLimit } = require('../middleware/rateLimit');

const router = express.Router();

const schema = z.object({
    email: z.string().email(),
    name: z.string().optional(),
    source: z.string().optional()
});

router.post('/', async (req, res, next) => {
    try {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';

        // L1 Rate Limit (Memory)
        rateLimit(`wl:${ip}`, 5, 60000);

        const data = validate(schema, req.body);

        // RPC call (Handles DB-level rate limit and insertion)
        const { data: rpcData, error } = await supabase.rpc('join_waitlist', {
            p_email: data.email,
            p_name: data.name,
            p_source: data.source || 'web',
            p_ip: ip
        });

        if (error) throw error;

        if (!rpcData.ok) {
            // Logic: If already exists, we might want to return success (idempotent) or error.
            // My RPC returns error 'Email already on waitlist'. 
            // Previous behavior was "idempotent success". 
            // If error is "Rate limit", return 429?
            if (rpcData.error && rpcData.error.includes('Rate limit')) {
                return fail(res, rpcData.error, 429);
            }
            // For email conflict, let's treat as success (to avoid leaking presence?) 
            // OR follow prompt instructions. "No client secrets". 
            // The RPC returns 'Email already on waitlist'.
            // I'll return success to be safe/idempotent, UNLESS it's a rate limit.
            if (rpcData.error.includes('Email already')) {
                return ok(res, { success: true, status: 'already_registered' });
            }

            return fail(res, rpcData.error, 400);
        }

        ok(res, { success: true });
    } catch (e) {
        next(e);
    }
});

module.exports = router;
