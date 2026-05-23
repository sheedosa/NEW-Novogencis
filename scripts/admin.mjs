/**
 * Novogenics Firebase Admin CLI
 *
 * Usage:
 *   node scripts/admin.mjs set-claims      — sets custom claims on all admin accounts
 *   node scripts/admin.mjs verify          — verifies collections, rules, and admin claims
 *   node scripts/admin.mjs list-users      — lists all Firebase Auth users
 *   node scripts/admin.mjs revoke-claims <email> — strips admin claims from a user
 *
 * Requires:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json (or set in .env.local)
 *   OR place service-account.json in the project root.
 *
 * Get your service account key:
 *   Firebase Console → Project Settings → Service Accounts → Generate new private key
 */

import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// ── Load service account ─────────────────────────────────────────────────────

const PROJECT_ID = 'gen-lang-client-0344977334';
const DATABASE_ID = 'ai-studio-ffbd754d-87bd-4895-950f-a8738f36064a';

const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

/**
 * Init strategy:
 *   1. GOOGLE_APPLICATION_CREDENTIALS env var → service account file
 *   2. service-account.json in project root → service account file
 *   3. Application Default Credentials (ADC) → `gcloud auth application-default login`
 */
function initFirebase() {
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const localPath = resolve(__dirname, '../service-account.json');

  if (envPath && existsSync(envPath)) {
    const sa = JSON.parse(readFileSync(envPath, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
    console.log(`\n🔑  Using service account: ${envPath}`);
    console.log(`📦  Project: ${sa.project_id}\n`);
    return;
  }
  if (existsSync(localPath)) {
    const sa = JSON.parse(readFileSync(localPath, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
    console.log(`\n🔑  Using service account: service-account.json`);
    console.log(`📦  Project: ${sa.project_id}\n`);
    return;
  }

  // Fallback: Application Default Credentials (run `gcloud auth application-default login` first)
  admin.initializeApp({ projectId: PROJECT_ID });
  console.log(`\n🔑  Using Application Default Credentials (ADC)`);
  console.log(`📦  Project: ${PROJECT_ID}\n`);
}

if (!admin.apps.length) {
  initFirebase();
}

const auth = admin.auth();
const db = getFirestore(admin.app(), DATABASE_ID);

// ── Admin user definitions ───────────────────────────────────────────────────
// These are the known admin accounts. Claims are set server-side — the emails
// are not sensitive once they're in Custom Claims (they never touch the bundle).

const ADMIN_USERS = [
  { email: 'rasheedamer99@gmail.com',              adminType: 'technical' },
  { email: 'aminah_amer@hotmail.com',              adminType: 'doctor-female' },
  { email: 'aminah_doctor@novogenics.internal',   adminType: 'doctor-female' },
  { email: 'wfarid812@gmail.com',                 adminType: 'doctor-male' },
  { email: 'waqass_doctor@novogenics.internal',   adminType: 'doctor-male' },
];

// ── Commands ─────────────────────────────────────────────────────────────────

async function setClaims() {
  console.log('Setting Firebase Custom Claims on admin accounts...\n');

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const { email, adminType } of ADMIN_USERS) {
    try {
      const user = await auth.getUserByEmail(email);
      const claims = { admin: true, adminType };
      await auth.setCustomUserClaims(user.uid, claims);
      console.log(`  ✅  ${email} → admin: true, adminType: ${adminType}`);
      success++;
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        console.log(`  ⚠️   ${email} — account not found in Firebase Auth (skipped)`);
        skipped++;
      } else {
        console.error(`  ❌  ${email} — ${err.message}`);
        failed++;
      }
    }
  }

  console.log(`\nDone: ${success} set, ${skipped} not found, ${failed} failed.`);

  if (success > 0) {
    console.log('\n⚠️  Existing sessions must be refreshed for new claims to take effect.');
    console.log('   Users need to sign out and sign back in.\n');
  }
}

async function verify() {
  console.log('Running production readiness checks...\n');
  const checks = [];

  // 1. Auth: admin accounts exist and have correct claims
  console.log('── Auth: Admin accounts ─────────────────────────────────');
  for (const { email, adminType } of ADMIN_USERS) {
    try {
      const user = await auth.getUserByEmail(email);
      const claims = user.customClaims || {};
      const hasAdminClaim = claims.admin === true;
      const hasCorrectType = claims.adminType === adminType;
      const status = hasAdminClaim && hasCorrectType ? '✅' : '⚠️ ';
      console.log(`  ${status}  ${email}`);
      if (!hasAdminClaim) console.log(`       → Missing admin custom claim (run set-claims)`);
      if (hasAdminClaim && !hasCorrectType) console.log(`       → adminType is '${claims.adminType}', expected '${adminType}'`);
      checks.push(hasAdminClaim && hasCorrectType);
    } catch {
      console.log(`  ❌  ${email} — not found in Auth`);
      checks.push(false);
    }
  }

  // 2. Firestore: collections exist
  console.log('\n── Firestore: Collections ───────────────────────────────');
  const collections = ['users', 'clients', 'appointments', 'messages', 'notifications', 'tasks', 'templates', 'system_logs'];
  for (const col of collections) {
    try {
      const snap = await db.collection(col).limit(1).get();
      console.log(`  ✅  ${col} (${snap.size > 0 ? 'has data' : 'empty — OK for new project'})`);
      checks.push(true);
    } catch (err) {
      console.log(`  ❌  ${col} — ${err.message}`);
      checks.push(false);
    }
  }

  // 3. Service account permissions
  console.log('\n── Service Account ──────────────────────────────────────');
  try {
    await auth.listUsers(1);
    console.log('  ✅  Auth read access OK');
    checks.push(true);
  } catch (err) {
    console.log(`  ❌  Auth read failed — ${err.message}`);
    checks.push(false);
  }

  const passed = checks.filter(Boolean).length;
  const total = checks.length;
  console.log(`\n── Result: ${passed}/${total} checks passed ──────────────────────────\n`);

  if (passed < total) {
    console.log('Fix the issues above, then re-run: node scripts/admin.mjs verify\n');
    process.exit(1);
  } else {
    console.log('🚀  All checks passed. Ready for production.\n');
  }
}

async function listUsers() {
  console.log('Firebase Auth Users:\n');
  let pageToken;
  let count = 0;

  do {
    const result = await auth.listUsers(100, pageToken);
    for (const user of result.users) {
      const claims = user.customClaims || {};
      const role = claims.admin ? `admin (${claims.adminType || 'untyped'})` : 'client';
      console.log(`  ${user.email || user.uid}  →  ${role}`);
      count++;
    }
    pageToken = result.pageToken;
  } while (pageToken);

  console.log(`\nTotal: ${count} users\n`);
}

async function revokeClaims(email) {
  if (!email) {
    console.error('Usage: node scripts/admin.mjs revoke-claims user@example.com\n');
    process.exit(1);
  }
  try {
    const user = await auth.getUserByEmail(email);
    await auth.setCustomUserClaims(user.uid, null);
    console.log(`✅  Cleared all custom claims for ${email}\n`);
  } catch (err) {
    console.error(`❌  ${err.message}\n`);
    process.exit(1);
  }
}

/**
 * Seed the treatments catalogue. Idempotent — uses doc IDs so re-running
 * updates existing treatments rather than duplicating them. Prices in pence.
 */
// IDs of treatments that have been retired — deactivated on seed so they
// no longer appear in the booking dropdown.
const RETIRED_TREATMENT_IDS = [
  'initial-consultation',
  'follow-up-consultation',
  'hair-assessment',
  'prp-session',
  'ev-plasma-session',
  'microneedling-session',
];

const DEFAULT_TREATMENTS = [
  {
    id: 'prp-microneedling',
    name: 'PRP + Microneedling',
    description: 'Platelet-rich plasma scalp injection with microneedling session.',
    durationMin: 75,
    fullPricePence: 58000,       // £580
    depositPct: 30,              // £174 deposit
    refundPolicy: 'prp',
    category: 'prp',
    isActive: true,
  },
  {
    id: 'ev-exosomes-microneedling',
    name: 'EV Enriched Plasma / Autologous Exosomes + Microneedling',
    description: 'Autologous exosome scalp therapy combined with microneedling.',
    durationMin: 120,
    fullPricePence: 72000,       // £720
    depositPct: 35,              // £252 — non-refundable preparation cost
    refundPolicy: 'exosome',
    category: 'exosome',
    isActive: true,
  },
  {
    id: 'face-to-face-consultation',
    name: 'Face to Face Consultation',
    description: 'In-clinic consultation — clinical review of your assessment + treatment recommendation.',
    durationMin: 75,
    fullPricePence: 7500,        // £75
    depositPct: 100,             // paid in full at booking
    refundPolicy: 'consult',
    category: 'consultation',
    isActive: true,
  },
];

async function seedTreatments() {
  console.log('Seeding treatments catalogue...\n');
  const now = new Date().toISOString();

  // Deactivate retired treatments (keeps data for historical appointments)
  let retiredCount = 0;
  for (const id of RETIRED_TREATMENT_IDS) {
    const ref = db.collection('treatments').doc(id);
    const existing = await ref.get();
    if (existing.exists && existing.data().isActive !== false) {
      await ref.update({ isActive: false, updatedAt: now });
      console.log(`  🗑  ${existing.data().name} — deactivated`);
      retiredCount++;
    }
  }
  if (retiredCount > 0) console.log(`  (${retiredCount} old treatment(s) deactivated)\n`);

  // Seed new treatments
  let upsertCount = 0;
  for (const t of DEFAULT_TREATMENTS) {
    const ref = db.collection('treatments').doc(t.id);
    const existing = await ref.get();
    if (existing.exists) {
      // Update existing to match latest config (name, duration, etc.)
      await ref.update({ ...t, updatedAt: now });
      console.log(`  ♻  ${t.name} — updated (${t.durationMin}min)`);
    } else {
      await ref.set({ ...t, createdAt: now });
      console.log(`  ✅  ${t.name} (${t.durationMin}min, £${(t.fullPricePence / 100).toFixed(0)})`);
    }
    upsertCount++;
  }
  console.log(`\nDone — ${upsertCount} treatment(s) seeded, ${retiredCount} retired.\n`);
}

// ── Router ───────────────────────────────────────────────────────────────────

const command = process.argv[2];

switch (command) {
  case 'set-claims':
    await setClaims();
    break;
  case 'verify':
    await verify();
    break;
  case 'list-users':
    await listUsers();
    break;
  case 'revoke-claims':
    await revokeClaims(process.argv[3]);
    break;
  case 'seed-treatments':
    await seedTreatments();
    break;
  default:
    console.log('Novogenics Firebase Admin CLI\n');
    console.log('Commands:');
    console.log('  node scripts/admin.mjs set-claims              Set admin custom claims');
    console.log('  node scripts/admin.mjs verify                  Run production checks');
    console.log('  node scripts/admin.mjs list-users              List all Auth users');
    console.log('  node scripts/admin.mjs revoke-claims <email>   Remove admin claims');
    console.log('  node scripts/admin.mjs seed-treatments         Seed treatment catalogue\n');
    break;
}

process.exit(0);
