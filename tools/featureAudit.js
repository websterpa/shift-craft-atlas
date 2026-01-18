const fs = require('fs');
const path = require('path');

/**
 * Antigravity Prompt 1 — Project feature audit
 */

const ROOT = path.resolve(__dirname, '..');

function checkPath(relPath) {
    return fs.existsSync(path.join(ROOT, relPath));
}

function checkContent(relPath, pattern) {
    if (!checkPath(relPath)) return false;
    const content = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
    return pattern.test(content);
}

// 1. Marketing Pages
const marketingPages = ['index', 'features', 'pricing', 'case-studies', 'docs', 'privacy', 'cookies'];
const marketingNotes = [];
marketingPages.forEach(p => {
    // Check various locations for pages (pages/ or src/pages/ or views/)
    // Instruction says: "/pages/index"
    if (checkPath(`pages/${p}.html`) || checkPath(`src/pages/${p}.html`) || checkPath(`pages/${p}.js`) || checkPath(`src/pages/${p}.js`)) {
        marketingNotes.push(p);
    }
});
const marketingStatus = marketingNotes.length === marketingPages.length ? 'present' : (marketingNotes.length > 0 ? 'partial' : 'missing');

// 2. Industry Overlays
const hasIndustryIndex = checkPath('pages/industries/index.html') || checkPath('src/pages/industries/index.html');
const hasVerticalsJson = checkPath('content/verticals.json') || checkPath('src/content/verticals.json');
const industryStatus = (hasIndustryIndex && hasVerticalsJson) ? 'present' : 'missing';

// 3. Pricing Config
const hasPricingConfig = checkPath('config/plans.json') || checkPath('src/config/plans.json');
const pricingStatus = hasPricingConfig ? 'present' : 'missing';

// 4. Auth & Onboarding
const hasAuth = checkPath('app/auth') || checkPath('src/app/auth');
const hasOnboarding = checkPath('app/onboarding/start.html') || checkPath('src/app/onboarding/start.html');
const authStatus = (hasAuth && hasOnboarding) ? 'present' : 'missing';

// 5. Admin
const hasAdminFlags = checkPath('admin/flags') || checkPath('src/admin/flags');
const hasAdminFunnel = checkPath('app/admin/funnel') || checkPath('src/app/admin/funnel');
const adminStatus = (hasAdminFlags && hasAdminFunnel) ? 'present' : 'missing';

// 6. Flags Integration
// Check for RPC in migrations and client helper
// We know Migration 02_flags.sql or 99_final_consolidated.sql has 'get_public_flags'
const migrationsDir = path.join(ROOT, 'supabase/migrations');
let hasRpcFlags = false;
if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir);
    for (const f of files) {
        const content = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
        if (content.includes('create or replace function public.get_public_flags')) {
            hasRpcFlags = true;
            break;
        }
    }
}
const hasClientFlags = checkContent('src/js/lib/flags.js', /supabase\.rpc\('get_public_flags'\)/);
const flagsStatus = (hasRpcFlags && hasClientFlags) ? 'present' : 'broken';

// 7. Waitlist
const hasWaitlistScreen = checkContent('index.html', /id="access-gate"/) || checkContent('src/js/earlyAccess.js', /access-gate/);
const hasWaitlistRpc = checkContent('src/js/lib/waitlist.js', /supabase\.rpc\('join_waitlist'/);
const waitlistStatus = (hasWaitlistScreen && hasWaitlistRpc) ? 'present' : 'broken';

// 8. Invites
const hasInvitesRpc = checkContent('src/js/lib/invites.js', /supabase\.rpc\('validate_invite'/);
const invitesStatus = hasInvitesRpc ? 'present' : 'broken';

// 9. Audit
// Check migrations for audit_log table
let hasAuditTable = false;
if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir);
    for (const f of files) {
        const content = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
        if (content.includes('create table if not exists audit_log')) {
            hasAuditTable = true;
            break;
        }
    }
}
const auditStatus = hasAuditTable ? 'present' : 'missing';

// 10. Roster UI
// Monthly header present?
const hasMonthlyView = checkPath('src/js/roster/MonthlyRosterView.js') || checkContent('src/js/app.js', /MonthlyRosterView/);
const rosterStatus = hasMonthlyView ? 'present' : 'partial';

// 11. Cookie Consent
const hasCookieBanner = checkContent('index.html', /cookie-consent/) || checkContent('src/js/app.js', /CookieConsent/);
const cookieStatus = hasCookieBanner ? 'present' : 'missing';


const report = {
    marketing: {
        status: marketingStatus,
        notes: marketingNotes.length > 0 ? `Found: ${marketingNotes.join(', ')}` : 'No marketing pages found in /pages/ or /src/pages/'
    },
    industries: {
        status: industryStatus,
        notes: hasIndustryIndex ? 'Industry folder present' : 'Missing /pages/industries'
    },
    pricing_config: {
        status: pricingStatus,
        notes: hasPricingConfig ? 'Found plans.json' : 'No config/plans.json'
    },
    auth_onboarding: {
        status: authStatus,
        notes: `Auth: ${hasAuth}, Onboarding: ${hasOnboarding}`
    },
    admin: {
        status: adminStatus,
        notes: `Flags: ${hasAdminFlags}, Funnel: ${hasAdminFunnel}`
    },
    flags_integration: {
        status: flagsStatus,
        notes: hasRpcFlags ? 'RPC and Client helper found' : 'RPC or Client helper missing'
    },
    waitlist: {
        status: waitlistStatus,
        notes: hasWaitlistScreen ? 'Screen and RPC wired' : 'Missing screen or RPC'
    },
    invites: {
        status: invitesStatus,
        notes: hasInvitesRpc ? 'RPC wired' : 'Missing RPC call'
    },
    audit: {
        status: auditStatus,
        notes: hasAuditTable ? 'Table definition found in migrations' : 'audit_log table missing'
    },
    roster_ui: {
        status: rosterStatus,
        notes: hasMonthlyView ? 'Monthly View detected' : 'Missing Monthly View'
    },
    cookie_consent: {
        status: cookieStatus,
        notes: hasCookieBanner ? 'Banner code found' : 'No cookie consent code detected'
    }
};

console.log(JSON.stringify(report, null, 2));
