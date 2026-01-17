function ok(res, body, status = 200) {
    res.status(status).json(body);
}

function fail(res, message, status = 400) {
    res.status(status).json({ error: { message } }, status);
}

module.exports = { ok, fail };
