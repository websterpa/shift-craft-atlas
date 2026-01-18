import { loadFlags } from './lib/flags.js';
import { validateInvite } from './lib/invites.js';
import { joinWaitlist } from './lib/waitlist.js';

// Bind UI Events Immediately
// ----------------------------
const waitlistBtn = document.getElementById('gate-waitlist-btn');
console.log('[EarlyAccess] Waitlist Button found:', !!waitlistBtn);

if (waitlistBtn) {
    waitlistBtn.onclick = () => {
        console.log('[EarlyAccess] Opening Waitlist Modal');
        const modal = document.getElementById('waitlist-modal');
        if (modal) modal.style.display = 'flex';
    };
}

const closeWaitlist = document.getElementById('close-waitlist');
if (closeWaitlist) {
    closeWaitlist.onclick = () => {
        document.getElementById('waitlist-modal').style.display = 'none';
    };
}

const waitlistForm = document.getElementById('waitlist-form');
console.log('[EarlyAccess] Waitlist Form found:', !!waitlistForm);

if (waitlistForm) {
    waitlistForm.onsubmit = async (e) => {
        e.preventDefault();
        console.log('[EarlyAccess] Submitting Waitlist Form...');

        const emailIn = document.getElementById('waitlist-email');
        const nameIn = document.getElementById('waitlist-name');
        const email = emailIn ? emailIn.value : '';
        const name = nameIn ? nameIn.value : '';
        const btn = waitlistForm.querySelector('button[type="submit"]');

        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Joining...';
        }

        try {
            const res = await joinWaitlist(email, name, 'early_access_gate');
            console.log('[EarlyAccess] Join Result:', res);

            if (res.ok) {
                // Show Success State within Modal
                const formContent = waitlistForm.innerHTML;
                waitlistForm.innerHTML = `
                    <div style="text-align: center; padding: 2rem 0;">
                        <div style="width: 64px; height: 64px; background: rgba(16, 185, 129, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem auto;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                        <h3 style="margin-bottom: 0.5rem; color: #fff;">You're on the list!</h3>
                        <p style="color: var(--text-muted); margin-bottom: 2rem;">We'll notify you as soon as a spot opens up.</p>
                        <button type="button" class="btn btn-outline" id="dismiss-waitlist-success">Close</button>
                    </div>
                `;

                // Bind Close Button
                document.getElementById('dismiss-waitlist-success').onclick = () => {
                    document.getElementById('waitlist-modal').style.display = 'none';
                    // Reset form after delay to ensure next open is clean
                    setTimeout(() => {
                        waitlistForm.innerHTML = formContent;
                        // Re-bind submit event? No, replacing innerHTML destroys listeners on children, 
                        // but waitlistForm itself handles onsubmit.
                        // Wait, replacing innerHTML of FORM removes the INPUTS.
                        // So we need to reload the page or reconstruct the DOM to reset it.
                        // Actually, simpler to just hide the modal and let the reload happen or just keep it closed.
                        location.reload();
                    }, 300);
                };

            } else {
                alert('Error: ' + (res.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[EarlyAccess] Unexpected error:', err);
            alert('An unexpected error occurred. Please try again.');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Join Now';
            }
        }
    };
}


(async function initEarlyAccess() {
    // 1) Load Flags
    const flags = await loadFlags();
    console.log('[EarlyAccess] Flags loaded:', flags);

    // 2) Pre-launch Banner
    const banner = document.getElementById('prelaunch-banner');
    if (flags.prelaunch && flags.prelaunch.enabled) {
        if (banner) banner.style.display = 'block';
    } else {
        if (banner) banner.style.display = 'none';
    }

    // 3) Early Access Gate
    if (flags.inviteOnly && flags.inviteOnly.enabled) {
        checkGate();
    } else {
        // Not invite only, ensure allowed in
        sessionStorage.setItem('invite_ok', '1');
        document.getElementById('access-gate').style.display = 'none';
    }

    function checkGate() {
        // If already validated in session
        if (sessionStorage.getItem('invite_ok')) {
            document.getElementById('access-gate').style.display = 'none';
            return;
        }

        // Show Gate
        const gate = document.getElementById('access-gate');
        gate.style.display = 'flex';

        // Bind Submit
        const btn = document.getElementById('gate-submit');
        const input = document.getElementById('gate-code');
        const errorMsg = document.getElementById('gate-error');

        btn.onclick = async () => {
            const code = input.value.trim();
            if (!code) return;

            btn.disabled = true;
            btn.textContent = 'Verifying...';
            errorMsg.style.display = 'none';

            const res = await validateInvite(code);

            if (res.ok) {
                // Success
                sessionStorage.setItem('invite_ok', '1');
                gate.style.display = 'none';
                // Reload or just allow access? The page is already loaded (SPAish).
                // Just hiding the gate is enough.
            } else {
                errorMsg.textContent = res.error || 'Invalid Code';
                errorMsg.style.display = 'block';
                btn.disabled = false;
                btn.textContent = 'Enter Shift Craft';
            }
        };
    }

})();
