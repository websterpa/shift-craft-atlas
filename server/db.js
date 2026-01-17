const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');
const dbPath = path.resolve(__dirname, '../../database.sqlite');

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Flags Table
    db.run(`CREATE TABLE IF NOT EXISTS flags (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Waitlist Table
    db.run(`CREATE TABLE IF NOT EXISTS waitlist (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT,
        source TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip_hash TEXT
    )`);

    // Invites Table
    db.run(`CREATE TABLE IF NOT EXISTS invites (
        id TEXT PRIMARY KEY,
        code_hash TEXT NOT NULL UNIQUE,
        label TEXT,
        expires_at DATETIME,
        uses_remaining INTEGER,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Audit Log Table
    db.run(`CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        ts DATETIME DEFAULT CURRENT_TIMESTAMP,
        actor TEXT,
        action TEXT,
        resource TEXT,
        details TEXT
    )`);

    // Seed Flags
    const seedFlags = [
        ['prelaunch', JSON.stringify({ enabled: true })],
        ['inviteOnly', JSON.stringify({ enabled: true })],
        ['enableBilling', JSON.stringify({ enabled: false })],
        ['enableGenerator', JSON.stringify({ enabled: false })]
    ];
    const stmtFlags = db.prepare("INSERT OR IGNORE INTO flags (key, value) VALUES (?, ?)");
    seedFlags.forEach(row => stmtFlags.run(row));
    stmtFlags.finalize();

    // Seed Invite: ATLAS2026
    const code = "ATLAS2026";
    const hash = crypto.createHash('sha256').update(code).digest('hex');
    const id = crypto.randomUUID();

    db.run(
        `INSERT OR IGNORE INTO invites (id, code_hash, label, uses_remaining) VALUES (?, ?, ?, ?)`,
        [id, hash, 'Early Access Beta', 1000]
    );
});

function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function findOne(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// Audit Helper
async function audit(actor, action, resource, details = {}) {
    const id = crypto.randomUUID();
    const jsonDetails = JSON.stringify(details);
    try {
        await run(
            "INSERT INTO audit_log (id, actor, action, resource, details) VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, ?)",
            [id, actor, action, resource, jsonDetails]
        );
    } catch (e) {
        console.error("Audit log failed", e);
    }
}

module.exports = { db, query, run, findOne, audit };
