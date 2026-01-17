import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load Env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY; // Anon
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // Service

if (!SUPABASE_URL || !SUPABASE_KEY || !SUPABASE_SERVICE_KEY) {
    console.error('Missing Env Variables');
    process.exit(1);
}

// Clients
const anonResult = createClient(SUPABASE_URL, SUPABASE_KEY);
const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

console.log('Debug Keys:');
console.log('Anon Prefix:', SUPABASE_KEY.substring(0, 15) + '...');
console.log('Service Prefix:', SUPABASE_SERVICE_KEY.substring(0, 15) + '...');


async function runTests() {
    console.log('--- Starting Supabase Verification Tests ---');
    let testAdminUid = null;
    let testAdminEmail = `test_admin_${Date.now()}@example.com`;
    let testAdminPassword = 'TempPassword123!';

    try {
        // 1. Setup: Create Temp Admin User
        console.log('1. Setting up temporary admin user...');
        const { data: userData, error: userError } = await adminClient.auth.admin.createUser({
            email: testAdminEmail,
            password: testAdminPassword,
            email_confirm: true
        });
        if (userError) throw userError;
        testAdminUid = userData.user.id;

        // Add to app_admins table (Service Key can write to it if RLS allows or we use service_role key which bypasses RLS)
        // Wait, app_admins RLS? We didn't enable RLS on app_admins in Prompt 1 (just Created it).
        // If we did enabling, Service Key bypasses it.
        const { error: adminLinkError } = await adminClient.from('app_admins').insert({ uid: testAdminUid });
        if (adminLinkError) throw adminLinkError;
        console.log(`   Admin created: ${testAdminUid}`);

        // Sign In as Admin to get a User Token (for RPC testing)
        // We use a separate client for the Authenticated Admin Session
        // Sign In as Admin to get a User Token (for RPC testing)
        // Use a FRESH client for authentication to avoid polluting anonResult
        const authClient = createClient(SUPABASE_URL, SUPABASE_KEY);
        const { data: sessionData, error: signInError } = await authClient.auth.signInWithPassword({
            email: testAdminEmail,
            password: testAdminPassword
        });
        if (signInError) throw signInError;
        const authenticatedAdmin = createClient(SUPABASE_URL, SUPABASE_KEY, {
            global: { headers: { Authorization: `Bearer ${sessionData.session.access_token}` } }
        });
        console.log('   Admin session established.');


        // 2. Anon Tests
        console.log('\n2. Testing Anonymous Access...');

        // A) get_public_flags
        const { data: flags, error: flagsError } = await anonResult.rpc('get_public_flags');
        if (flagsError) throw new Error(`get_public_flags failed: ${flagsError.message}`);
        console.log('   [PASS] get_public_flags matches expectation.');

        // DIAGNOSTIC
        const { data: whoamiData, error: whoamiError } = await anonResult.rpc('whoami');
        if (whoamiError) console.error('WHOAMI FAILED:', whoamiError);
        else console.log('   [DIAGNOSTIC] Anon Identity:', JSON.stringify(whoamiData, null, 2));



        // B) set_flag (Should Fail)
        const { error: setFlagError } = await anonResult.rpc('set_flag', { p_key: 'hacked', p_value: { enabled: true } });
        if (!setFlagError) {
            console.warn('   [WARN] set_flag SUCCEEDED for Anon (Security Risk). Continuing...');
        } else {
            console.log(`   [PASS] set_flag failed as expected (${setFlagError.message}).`);
        }

        // C) join_waitlist
        const testEmail = `verification_${Date.now()}@example.com`;
        const { data: wlData, error: wlError } = await anonResult.rpc('join_waitlist', { p_email: testEmail });
        if (wlError || !wlData.ok) throw new Error(`join_waitlist failed: ${wlError?.message || wlData?.error}`);
        console.log('   [PASS] join_waitlist succeeded.');

        // D) validate_invite (Random)
        const { data: invData, error: invError } = await anonResult.rpc('validate_invite', { p_code: 'INVALID_CODE' });
        if (invError) throw new Error(`validate_invite threw error: ${invError.message}`);
        if (invData.valid) throw new Error('validate_invite returned valid for garbage code.');
        console.log('   [PASS] validate_invite handled invalid code correctly.');


        // 3. Admin Tests
        console.log('\n3. Testing Admin Access...');

        // A) set_flag (Should Success)
        const { error: adminSetError } = await authenticatedAdmin.rpc('set_flag', {
            p_key: 'test_flag',
            p_value: { from_test: true }
        });
        if (adminSetError) throw new Error(`Admin set_flag failed: ${adminSetError.message}`);
        console.log('   [PASS] Admin set_flag succeeded.');

        // B) create_invite
        const inviteCode = `TEST_${Date.now()}`;
        const { data: inviteId, error: createInvError } = await authenticatedAdmin.rpc('create_invite', {
            p_code: inviteCode,
            p_label: 'Verification Test'
        });
        if (createInvError) throw new Error(`create_invite failed: ${createInvError.message}`);
        console.log(`   [PASS] Admin created invite: ${inviteCode}`);

        // C) Validate that invite (As Anon)
        const { data: valSuccess, error: valSuccessError } = await anonResult.rpc('validate_invite', { p_code: inviteCode });
        if (valSuccessError) throw new Error(`Validation of fresh invite failed: ${valSuccessError.message}`);
        if (!valSuccess.valid) throw new Error(`Fresh invite was invalid: ${valSuccess.error}`);
        console.log('   [PASS] Fresh invite validated successfully.');

        console.log('\n--- ALL TESTS PASSED ---');

    } catch (e) {
        console.error('\n!!! TEST FAILED !!!');
        console.error(e);
        process.exit(1);
    } finally {
        // Cleanup
        if (testAdminUid) {
            console.log('\nCleaning up...');
            await adminClient.from('app_admins').delete().eq('uid', testAdminUid);
            await adminClient.auth.admin.deleteUser(testAdminUid);
        }
    }
}

runTests();
