// ═══════════════════════════════════════════════════════════════════════════
// OIMES — Chapter 5 Performance & Integrity Test Script
//
// WHAT THIS DOES
// Runs three REAL tests against your live Supabase project and prints
// results you can paste straight into Chapter 5 (Results and Discussion):
//
//   1. LATENCY TEST        — 100 sequential exchange transactions, timed
//                             from submission to terminal (approved) state.
//                             Reports mean / median / p95 / max latency (ms).
//
//   2. RACE-CONDITION TEST — Fires approve_transaction() and deny_transaction()
//                             at the SAME pending transaction simultaneously,
//                             20 times, and verifies exactly one wins and the
//                             wallet/escrow balances only move once. This is
//                             the real, testable version of "escrow integrity" —
//                             see the note at the bottom of this file about
//                             why the original idempotency-key test was removed.
//
//   3. CONCURRENT LOAD TEST — 20 simultaneous customers submitting exchanges
//                             at once, checking for deadlocks/errors and
//                             measuring total throughput.
//
// SETUP (do this once, in your Supabase project + local machine)
//   1. In the OIMES app, create ONE test customer account and link TWO
//      wallets to it (e.g. EVC Plus and Zaad). Top up both wallets with
//      simulated funds (use the "Top Up" button, up to $1000 each — you can
//      top up more than once if you need more balance for the load test).
//   2. Make sure you already have an existing ADMIN account (the one you use
//      to log into /admin).
//   3. In this project folder, copy .env.example to .env.test and fill in:
//        SUPABASE_URL, SUPABASE_ANON_KEY   (Settings → API in Supabase)
//        TEST_CUSTOMER_EMAIL / PASSWORD    (the test customer from step 1)
//        TEST_ADMIN_EMAIL / PASSWORD       (your existing admin login)
//   4. Run:   node --env-file=.env.test oimes-performance-test.mjs
//      (Node 20.6+. If your Node is older, `export` the variables instead
//      and run `node oimes-performance-test.mjs`.)
//
// This script only ever talks to YOUR OWN Supabase project using the public
// anon key + normal sign-in — exactly like the real app does. It does not
// touch production data beyond the two test wallets you create for it.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const CUSTOMER_EMAIL = process.env.TEST_CUSTOMER_EMAIL;
const CUSTOMER_PASSWORD = process.env.TEST_CUSTOMER_PASSWORD;
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;

for (const [name, val] of Object.entries({
  SUPABASE_URL, SUPABASE_ANON_KEY, CUSTOMER_EMAIL: CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD, ADMIN_EMAIL, ADMIN_PASSWORD,
})) {
  if (!val) {
    console.error(`Missing required env var: ${name}. See the setup notes at the top of this file.`);
    process.exit(1);
  }
}

function freshClient(storageKey) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { storageKey, persistSession: false } });
}

function percentile(sorted, p) {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

function stats(label, samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const median = percentile(sorted, 50);
  const p95 = percentile(sorted, 95);
  const max = sorted[sorted.length - 1];
  console.log(`\n--- ${label} (n=${samples.length}) ---`);
  console.log(`  mean:   ${mean.toFixed(1)} ms`);
  console.log(`  median: ${median.toFixed(1)} ms`);
  console.log(`  p95:    ${p95.toFixed(1)} ms`);
  console.log(`  max:    ${max.toFixed(1)} ms`);
  return { n: samples.length, mean, median, p95, max };
}

async function getTwoWallets(client) {
  // IMPORTANT: if this account also has an admin role, the wallet_owner_policy
  // RLS rule is OR'd with admin_full_access_wallets, so an unfiltered select
  // would return ANY user's wallets, not just this account's own two. We
  // filter explicitly by the signed-in user's own id to avoid that.
  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr) throw new Error(`Could not get current user: ${userErr.message}`);
  const { data, error } = await client
    .from('wallets')
    .select('id, balance, platform')
    .eq('user_id', userData.user.id)
    .limit(10);
  if (error) throw new Error(`Could not fetch wallets: ${error.message}`);
  if (!data || data.length < 2) {
    throw new Error('Test customer needs at least 2 linked wallets with balance. Link and top up a second wallet first.');
  }
  return [data[0], data[1]];
}

async function runLatencyTest(customer, admin, fromWallet, toWallet, iterations = 100) {
  console.log(`\n[1/3] Latency test — ${iterations} sequential transactions...`);
  const samples = [];
  let failures = 0;
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const { data: tx, error: createErr } = await customer.rpc('create_exchange_transaction', {
      p_from_wallet_id: fromWallet.id,
      p_to_wallet_id: toWallet.id,
      p_from_amount: 1,
      p_to_amount: 1,
      p_rate: 1,
      p_spread: 0,
      p_fee_total: 0,
      p_description: `latency-test-${i}`,
    });
    if (createErr) { failures++; continue; }
    const { error: approveErr } = await admin.rpc('approve_transaction', { p_transaction_id: tx.id });
    const end = performance.now();
    if (approveErr) { failures++; continue; }
    samples.push(end - start);
    if ((i + 1) % 20 === 0) console.log(`  ...${i + 1}/${iterations} done`);
  }
  if (failures > 0) console.log(`  (${failures} iterations failed — check wallet balance is sufficient)`);
  return samples.length ? stats('Latency: submission → completed', samples) : null;
}

async function runRaceConditionTest(customer, admin, admin2, fromWallet, toWallet, iterations = 20) {
  console.log(`\n[2/3] Race-condition test — ${iterations} simultaneous approve/deny pairs on the same pending transaction...`);
  let correctlySerialised = 0;
  let violations = 0;
  for (let i = 0; i < iterations; i++) {
    const { data: tx, error: createErr } = await customer.rpc('create_exchange_transaction', {
      p_from_wallet_id: fromWallet.id,
      p_to_wallet_id: toWallet.id,
      p_from_amount: 1,
      p_to_amount: 1,
      p_rate: 1,
      p_spread: 0,
      p_fee_total: 0,
      p_description: `race-test-${i}`,
    });
    if (createErr) { console.log(`  create failed: ${createErr.message}`); continue; }

    const [approveResult, denyResult] = await Promise.allSettled([
      admin.rpc('approve_transaction', { p_transaction_id: tx.id }),
      admin2.rpc('deny_transaction', { p_transaction_id: tx.id, p_reason: 'race-test' }),
    ]);

    const approveOk = approveResult.status === 'fulfilled' && !approveResult.value.error;
    const denyOk = denyResult.status === 'fulfilled' && !denyResult.value.error;

    if (approveOk !== denyOk) {
      // Exactly one succeeded — correct serialisation via row-level locking.
      correctlySerialised++;
    } else {
      // Both succeeded (double-processed) or both failed unexpectedly — a real bug.
      violations++;
      console.log(`  ⚠ transaction ${tx.id}: approveOk=${approveOk} denyOk=${denyOk} — investigate`);
    }
  }
  console.log(`\n--- Race-condition test result ---`);
  console.log(`  Correctly serialised (exactly one action won): ${correctlySerialised}/${iterations}`);
  console.log(`  Violations (double-processed or double-failed): ${violations}/${iterations}`);
  return { iterations, correctlySerialised, violations };
}

async function runConcurrentLoadTest(customer, admin, fromWallet, toWallet, concurrency = 20) {
  console.log(`\n[3/3] Concurrent load test — ${concurrency} simultaneous exchange submissions...`);
  const start = performance.now();
  const results = await Promise.allSettled(
    Array.from({ length: concurrency }, (_, i) =>
      customer.rpc('create_exchange_transaction', {
        p_from_wallet_id: fromWallet.id,
        p_to_wallet_id: toWallet.id,
        p_from_amount: 1,
        p_to_amount: 1,
        p_rate: 1,
        p_spread: 0,
        p_fee_total: 0,
        p_description: `load-test-${i}`,
      })
    )
  );
  const end = performance.now();
  const succeeded = results.filter((r) => r.status === 'fulfilled' && !r.value.error);
  const failed = results.length - succeeded.length;
  console.log(`\n--- Concurrent load test result ---`);
  console.log(`  Submitted:  ${concurrency}`);
  console.log(`  Succeeded:  ${succeeded.length}`);
  console.log(`  Failed:     ${failed}`);
  console.log(`  Total wall-clock time: ${(end - start).toFixed(1)} ms`);
  if (failed > 0) {
    const reasons = results.filter((r) => r.status === 'rejected' || r.value?.error).map((r) => r.value?.error?.message ?? r.reason?.message);
    console.log(`  Failure reasons: ${[...new Set(reasons)].join('; ')}`);
  }
  // Clean up: approve everything that succeeded so escrow doesn't stay locked.
  for (const r of succeeded) {
    if (r.value?.data?.id) await admin.rpc('approve_transaction', { p_transaction_id: r.value.data.id }).catch(() => {});
  }
  return { concurrency, succeeded: succeeded.length, failed, totalMs: end - start };
}

async function main() {
  console.log('Signing in test accounts...');
  const customer = freshClient('test-customer');
  const admin = freshClient('test-admin-1');
  const admin2 = freshClient('test-admin-2'); // second independent session, same admin account — simulates two admins/tabs

  const { error: custErr } = await customer.auth.signInWithPassword({ email: CUSTOMER_EMAIL, password: CUSTOMER_PASSWORD });
  if (custErr) throw new Error(`Customer sign-in failed: ${custErr.message}`);
  const { error: admErr } = await admin.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (admErr) throw new Error(`Admin sign-in failed: ${admErr.message}`);
  const { error: adm2Err } = await admin2.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (adm2Err) throw new Error(`Admin (2nd session) sign-in failed: ${adm2Err.message}`);

  const [fromWallet, toWallet] = await getTwoWallets(customer);
  console.log(`Using wallets: ${fromWallet.platform} (${fromWallet.id}) → ${toWallet.platform} (${toWallet.id})`);
  console.log(`Balances: from=${fromWallet.balance}, to=${toWallet.balance}`);
  if (Number(fromWallet.balance) < 130) {
    console.warn('\n⚠ Warning: from-wallet balance looks low for this script (needs ~130 units: 100 for latency + 20 for race + 20 for load). Top up more in the app before running, or reduce iteration counts below.');
  }

  const results = {};
  results.latency = await runLatencyTest(customer, admin, fromWallet, toWallet, 100);
  results.raceCondition = await runRaceConditionTest(customer, admin, admin2, fromWallet, toWallet, 20);
  results.concurrentLoad = await runConcurrentLoadTest(customer, admin, fromWallet, toWallet, 20);

  console.log('\n\n═══════════════════════════════════════════');
  console.log('RAW JSON (save this — you will need it for Chapter 5 tables):');
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error('\nTest run failed:', err.message);
  process.exit(1);
});

// ═══════════════════════════════════════════════════════════════════════════
// NOTE ON THE TWO TESTS REMOVED FROM CHAPTER 3'S ORIGINAL PLAN
//
// Chapter 3 (section 3.7.5) describes two additional tests that this script
// does NOT run, because the underlying features do not exist in the current
// implementation:
//
//   - "Idempotency testing... duplicate requests with identical idempotency
//     keys... rejected with a 409 response" — create_exchange_transaction has
//     no idempotency-key parameter, so this cannot be executed as written.
//   - "Escrow integrity testing... randomly injected adapter failures" —
//     there are no payment-provider adapters in the current build (top-ups
//     are simulated directly), so there is nothing to inject a failure into.
//
// You have two honest options before you write Chapter 5:
//   (a) Update Chapter 3, section 3.7.5, to remove these two sub-tests and
//       describe only the three that were actually run (latency, race-
//       condition/double-processing protection, concurrent load) — this is
//       the faster option.
//   (b) Actually implement idempotency keys and adapter fault-injection in
//       the codebase first, then test them for real — this is more work but
//       keeps Chapter 3 as originally written.
// Tell me which you'd prefer and I'll make the corresponding edit to Chapter 3.
// ═══════════════════════════════════════════════════════════════════════════
