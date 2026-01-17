const express = require('express');
const { z } = require('zod');
const { supabase } = require('../lib/supabase');
const { validate } = require('../lib/validate');
const { ok, fail } = require('../lib/respond');
const { rateLimit } = require('../middleware/rateLimit');

const router = express.Router();

const schema = z.object({
    code: z.string().min(1)
});

router.post('/validate', async (req, res, next) => {
    try {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';

        // Rate limit validation attempts (5 per minute per IP)
        rateLimit(`inv:${ip}`, 5, 60000);

        const { code } = validate(schema, req.body);

        // RPC Call
        const { data, error } = await supabase.rpc('validate_invite', {
            p_code: code
        });

        if (error) throw error;

        if (!data.valid) {
            return fail(res, data.error || 'Invalid invite code', 400);
        }

        ok(res, { valid: true, label: data.label || 'Early Access' });
    } catch (e) {
        next(e);
    }
});

module.exports = router;
