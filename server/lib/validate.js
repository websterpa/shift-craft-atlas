const { z } = require("zod");

function validate(schema, payload) {
    const res = schema.safeParse(payload);
    if (!res.success) {
        const msg = res.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join(", ");
        const err = new Error(`Bad request: ${msg}`);
        err.status = 400;
        throw err;
    }
    return res.data;
}

module.exports = { validate };
