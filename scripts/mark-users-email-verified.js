/**
 * Mark tenant users as email-verified and clear OTP fields (for invited users
 * created before API changes, or one-off fixes).
 *
 * Usage:
 *   node scripts/mark-users-email-verified.js --dry-run
 *   node scripts/mark-users-email-verified.js
 *
 * Default mode "invited" updates rows where:
 *   isEmailVerified = false AND otpCode IS NULL AND otpExpiry IS NULL
 * (typical invited user; self-signup pending verification usually has otpCode set.)
 *
 * Options:
 *   --dry-run              List matches only, no updates
 *   --tenant-id=<id>     Limit to users with this tenantId
 *   --emails=a@x,b@y     Limit to these emails (comma-separated)
 *   --all-unverified     Every user with isEmailVerified false (use with --tenant-id recommended)
 *
 * Loads env from .env in project root when present.
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function parseArgs(argv) {
  const out = {
    dryRun: false,
    tenantId: null,
    emails: null,
    mode: 'invited',
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--all-unverified') out.mode = 'all';
    else if (a.startsWith('--tenant-id='))
      out.tenantId = a.slice('--tenant-id='.length).trim() || null;
    else if (a.startsWith('--emails=')) {
      out.emails = a
        .slice('--emails='.length)
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    }
  }
  return out;
}

function buildWhere(opts) {
  if (opts.emails?.length) {
    return {
      email: { in: opts.emails },
      isEmailVerified: false,
      ...(opts.tenantId ? { tenantId: opts.tenantId } : {}),
    };
  }
  const base = {
    isEmailVerified: false,
    ...(opts.tenantId ? { tenantId: opts.tenantId } : {}),
  };
  if (opts.mode === 'all') {
    return base;
  }
  return {
    ...base,
    otpCode: null,
    otpExpiry: null,
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Add it to .env or export it before running.');
    process.exit(1);
  }

  const where = buildWhere(opts);

  const candidates = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      tenantId: true,
      isEmailVerified: true,
      otpCode: true,
      otpExpiry: true,
    },
    orderBy: { email: 'asc' },
  });

  console.log('\n=== mark-users-email-verified ===');
  console.log(`Mode: ${opts.emails?.length ? 'emails' : opts.mode}${opts.tenantId ? ` | tenantId=${opts.tenantId}` : ''}`);
  console.log(`Dry run: ${opts.dryRun}`);
  console.log(`Matches: ${candidates.length}\n`);

  for (const u of candidates) {
    console.log(
      `  ${u.email} | ${u.name || '(no name)'} | tenant=${u.tenantId || '-'} | otpCode=${u.otpCode ? 'set' : 'null'}`
    );
  }

  if (opts.dryRun) {
    console.log('\n(--dry-run: no changes written)\n');
    return;
  }

  if (candidates.length === 0) {
    console.log('\nNothing to update.\n');
    return;
  }

  const result = await prisma.user.updateMany({
    where,
    data: {
      isEmailVerified: true,
      otpCode: null,
      otpExpiry: null,
    },
  });

  console.log(`\nUpdated ${result.count} user(s).\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
