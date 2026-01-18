
/**
 * AuditLog
 * Records system events and provides an audit trail interface.
 */
class AuditLog {
    constructor(app) {
        this.app = app;
        this.STORAGE_KEY = 'shiftcraft_audit_log';
    }

    /**
     * Log an event
     * @param {string} action - Event type (e.g. 'PUBLISH', 'EDIT_SHIFT')
     * @param {string|object} details - Description or details object
     * @param {string} user - User/Actor ID
     * @param {object} meta - Structured metadata (entityType, entityId, before, after, reason)
     */
    log(action, details, user = 'System', meta = {}) {
        // Handle legacy call signature: log(action, details, user)
        let logDetails = details;
        if (typeof details === 'object') {
            logDetails = JSON.stringify(details);
        }

        const entry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            action,
            details: logDetails,
            user,
            // Prompt 10 Structured Data
            entityType: meta.entityType || null,
            entityId: meta.entityId || null,
            reason: meta.reason || null,
            before: meta.before || null,
            after: meta.after || null
        };

        const logs = this.getLogs();
        logs.unshift(entry); // Newest first

        // Limit log size (e.g., 500 entries)
        if (logs.length > 500) logs.pop();

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(logs));
        console.log('[Audit]', action, logDetails, meta);
    }

    getLogs() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
        } catch (e) {
            console.error('Failed to parse audit log', e);
            return [];
        }
    }

    showModal() {
        const logs = this.getLogs();
        let html = `
            <div class="audit-modal-backdrop" id="audit-backdrop">
                <div class="audit-modal">
                    <div class="audit-header">
                        <h2><i data-lucide="clipboard-list"></i> Audit Log</h2>
                        <button class="btn btn-outline btn-icon" id="close-audit-btn"><i data-lucide="x"></i></button>
                    </div>
                    <div class="audit-content">
        `;

        if (logs.length === 0) {
            html += `<div style="text-align:center; padding:2rem; color:var(--text-muted)">No events recorded.</div>`;
        } else {
            html += '<table class="audit-table"><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Details</th><th>Reason</th></tr></thead><tbody>';
            logs.forEach(log => {
                const date = new Date(log.timestamp).toLocaleString();
                const reason = log.reason ? `<span class="audit-reason-badge">${log.reason}</span>` : '-';

                // Show structured diff if available
                let displayDetails = log.details;
                if (log.before && log.after) {
                    displayDetails += ` <span class="diff-indicator" title="Data changed">📝</span>`;
                }

                html += `
                    <tr>
                        <td style="white-space:nowrap; font-size:0.85rem; color:var(--text-muted)">${date}</td>
                        <td style="font-weight:600">${log.user}</td>
                        <td style="color:var(--accent-blue)">${log.action}</td>
                        <td style="font-family:monospace; font-size:0.9rem;">
                            ${displayDetails}
                            ${log.entityType ? `<div style="font-size:0.75rem;color:var(--text-muted)">ID: ${log.entityType}:${log.entityId}</div>` : ''}
                        </td>
                         <td>${reason}</td>
                    </tr>
                `;
            });
            html += '</tbody></table>';
        }

        html += `
                    </div>
                </div>
            </div>
            <style>
                .audit-modal-backdrop {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                    background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
                    display: flex; align-items: center; justify-content: center;
                    z-index: 2000;
                }
                .audit-modal {
                    background: var(--glass-bg); border: 1px solid var(--glass-border);
                    width: 90%; max-width: 800px; max-height: 80vh;
                    border-radius: 12px; display: flex; flex-direction: column;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.5);
                }
                .audit-header {
                    padding: 1rem 1.5rem; border-bottom: 1px solid var(--glass-border);
                    display: flex; justify-content: space-between; align-items: center;
                }
                .audit-content {
                    flex: 1; overflow-y: auto; padding: 0;
                }
                .audit-table {
                    width: 100%; border-collapse: collapse;
                }
                .audit-table th {
                    text-align: left; padding: 0.75rem 1rem; background: rgba(255,255,255,0.05);
                    font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted);
                    position: sticky; top: 0; background: #1a1a1a; /* fallback */
                }
                .audit-table td {
                    padding: 0.75rem 1rem; border-bottom: 1px solid var(--glass-border);
                    font-size: 0.9rem;
                }
            </style>
        `;

        // Remove existing
        const existing = document.getElementById('audit-backdrop');
        if (existing) existing.remove();

        document.body.insertAdjacentHTML('beforeend', html);

        // Bind Close
        document.getElementById('close-audit-btn').onclick = () => document.getElementById('audit-backdrop').remove();
        document.getElementById('audit-backdrop').onclick = (e) => {
            if (e.target.id === 'audit-backdrop') e.target.remove();
        };

        if (window.lucide) window.lucide.createIcons();
    }
}

window.AuditLog = AuditLog;
