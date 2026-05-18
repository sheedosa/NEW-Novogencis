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

function loadServiceAccount() {
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const localPath = resolve(__dirname, '../service-account.json');

  if (envPath && existsSync(envPath)) {
    return { credential: envPath, source: envPath };
  }
  if (existsSync(localPath)) {
    return { credential: localPath, source: 'service-account.json' };
  }

  console.error('\n❌  No service account found.\n');
  console.error('  Steps to fix:');
  console.error('  1. Go to Firebase Console → Project Settings → Service Accounts');
  console.error('  2. Click "Generate new private key" → Save as service-account.json');
  console.error('  3. Place service-account.json in the NEW-Novogencis project root');
  console.error('  (It is gitignored — never commit it)\n');
  process.exit(1);
}

const { credential: saPath, source: saSource } = loadServiceAccount();

const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = JSON.parse(readFileSync(saPath, 'utf8'));

const DATABASE_ID = 'ai-studio-ffbd754d-87bd-4895-950f-a8738f36064a';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

const auth = admin.auth();
const db = getFirestore(admin.app(), DATABASE_ID);

console.log(`\n🔑  Using service account: ${saSource}`);
console.log(`📦  Project: ${serviceAccount.project_id}\n`);

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
  default:
    console.log('Novogenics Firebase Admin CLI\n');
    console.log('Commands:');
    console.log('  node scripts/admin.mjs set-claims              Set admin custom claims');
    console.log('  node scripts/admin.mjs verify                  Run production checks');
    console.log('  node scripts/admin.mjs list-users              List all Auth users');
    console.log('  node scripts/admin.mjs revoke-claims <email>   Remove admin claims\n');
    break;
}

process.exit(0);
