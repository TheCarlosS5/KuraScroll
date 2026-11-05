import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import readline from 'node:readline/promises';
import { createDatabase, runMigrations } from '../src/backend/db/database.js';
import { AuthRepository } from '../src/backend/repositories/auth-repository.js';
import { AuthService } from '../src/backend/services/auth-service.js';

interface ParsedArgs {
  email?: string;
  handle?: string;
  password?: string;
  claimLegacy?: boolean;
  dbPath?: string;
}

function parseCliArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const parsed: ParsedArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--email' && args[i + 1]) {
      parsed.email = args[++i];
    } else if (arg === '--handle' && args[i + 1]) {
      parsed.handle = args[++i];
    } else if (arg === '--password' && args[i + 1]) {
      parsed.password = args[++i];
    } else if (arg === '--claim-legacy') {
      parsed.claimLegacy = true;
    } else if (arg === '--no-claim-legacy') {
      parsed.claimLegacy = false;
    } else if (arg === '--db' && args[i + 1]) {
      parsed.dbPath = args[++i];
    }
  }

  return parsed;
}

async function promptIfMissing(parsed: ParsedArgs): Promise<Required<Omit<ParsedArgs, 'dbPath'>> & { dbPath: string }> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const email = parsed.email || (await rl.question('Admin Email: ')).trim();
    const handle = parsed.handle || (await rl.question('Admin Handle: ')).trim();
    const password = parsed.password || (await rl.question('Admin Password (min 8 chars): ')).trim();

    let claimLegacy = parsed.claimLegacy;
    if (claimLegacy === undefined) {
      const answer = (
        await rl.question("Claim legacy 'local_user' reading progress & stats for this admin? (y/N): ")
      ).trim().toLowerCase();
      claimLegacy = answer === 'y' || answer === 'yes';
    }

    const defaultDbPath = process.env.DATABASE_PATH || path.resolve('./data/kura-scroll.db');
    const dbPath = parsed.dbPath || defaultDbPath;

    return { email, handle, password, claimLegacy, dbPath };
  } finally {
    rl.close();
  }
}

async function run(): Promise<void> {
  console.log('='.repeat(60));
  console.log(' [KuraScroll] Administrator Account Bootstrap Tool');
  console.log('='.repeat(60));

  const parsed = parseCliArgs();
  const input = await promptIfMissing(parsed);

  if (!input.email || !input.handle || !input.password) {
    console.error('Error: Email, handle, and password are all required.');
    process.exit(1);
  }

  if (input.password.length < 8) {
    console.error('Error: Password must be at least 8 characters long.');
    process.exit(1);
  }

  const normalizedEmail = input.email.trim().toLowerCase();
  const handle = input.handle.trim();

  const db = createDatabase(input.dbPath);

  // Apply all pending migrations (including identity)
  runMigrations(db);

  const authRepo = new AuthRepository(db);

  // Check if user already exists
  const existingByEmail = authRepo.findUserByEmail(normalizedEmail);
  const existingByHandle = authRepo.findUserByHandle(handle);

  if (existingByEmail) {
    console.error(`Error: User with email "${normalizedEmail}" already exists (ID: ${existingByEmail.id}, Role: ${existingByEmail.role}).`);
    process.exit(1);
  }

  if (existingByHandle) {
    console.error(`Error: User with handle "${handle}" already exists (ID: ${existingByHandle.id}, Role: ${existingByHandle.role}).`);
    process.exit(1);
  }

  const adminId = crypto.randomUUID();
  const passwordHash = AuthService.hashPassword(input.password);
  const now = new Date().toISOString();

  const adminUser = authRepo.createUser({
    id: adminId,
    emailNormalized: normalizedEmail,
    handle,
    passwordHash,
    role: 'admin',
    emailVerifiedAt: now,
  });

  console.log('\n[SUCCESS] Administrator created:');
  console.log(`  User ID:        ${adminUser.id}`);
  console.log(`  Email:          ${adminUser.emailNormalized}`);
  console.log(`  Handle:         ${adminUser.handle}`);
  console.log(`  Role:           ${adminUser.role}`);
  console.log(`  Email Verified: ${adminUser.emailVerifiedAt}`);

  if (input.claimLegacy) {
    console.log("\nClaiming legacy 'local_user' data...");
    const claimResult = authRepo.claimLegacyDataForAdmin(adminUser.id);
    console.log(`  Total rows reassigned: ${claimResult.totalRowsUpdated}`);
    for (const [table, count] of Object.entries(claimResult.claimedTables)) {
      if (count > 0) {
        console.log(`   - ${table}: ${count} rows`);
      }
    }
  }

  console.log('\nBootstrap completed successfully.');
}

void run().catch((err) => {
  console.error('\nFatal error creating admin:', err);
  process.exit(1);
});
