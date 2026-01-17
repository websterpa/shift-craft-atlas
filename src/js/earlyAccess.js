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
                alert('Thanks! You have been added to the waitlist.');
                document.getElementById('waitlist-modal').style.display = 'none';
                waitlistForm.reset();
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
