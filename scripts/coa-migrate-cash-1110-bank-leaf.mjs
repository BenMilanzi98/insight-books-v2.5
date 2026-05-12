#!/usr/bin/env node
/**
 * Data repair: Cash PaymentAccount → **1110**; reassign TransactionLines from bare **1130** → first **1130-xx** leaf.
 *
 * Usage:
 *   node scripts/coa-migrate-cash-1110-bank-leaf.mjs --dry-run
 *   node scripts/coa-migrate-cash-1110-bank-leaf.mjs --tenant=<cuid>
 *   node scripts/coa-migrate-cash-1110-bank-leaf.mjs
 *
 * Options:
 *   --dry-run
 *   --tenant=<id>
 *   --merge-cash-lines     Move lines from GL 1111–1119 → 1110
 *   --retire-legacy-cash-slots  acceptsNewTransactions=false on empty 1111–1119
 *
 * Uses jiti so `@/lib` aliases in imported modules resolve.
 */
import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createJiti } from 'jiti';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  alias: {
    '@/': `${rootDir.replace(/\\/g, '/')}/`,
  },
});

const LEGACY_CASH_CODES = ['1111', '1112', '1113', '1114', '1115', '1116', '1117', '1118', '1119'];

function parseArgs(argv) {
  const out = { dryRun: false, tenantId: null, mergeCashLines: false, retireLegacyCashSlots: false };
  for (const a of argv.slice(2)) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--merge-cash-lines') out.mergeCashLines = true;
    else if (a === '--retire-legacy-cash-slots') out.retireLegacyCashSlots = true;
    else if (a.startsWith('--tenant=')) out.tenantId = a.slice('--tenant='.length).trim();
  }
  return out;
}

function normCode(a) {
  return String(a?.accountCode ?? a?.code ?? '').trim();
}

async function reassignLinesForAccount(prisma, tenantId, fromAccountId, toAccountId, label, dryRun) {
  const lines = await prisma.transactionLine.findMany({
    where: {
      accountId: fromAccountId,
      transaction: { tenantId },
    },
    select: { id: true },
  });
  console.log(`  ${label}: ${lines.length} TransactionLine(s)`);
  if (dryRun || lines.length === 0) return;
  const BATCH = 400;
  for (let i = 0; i < lines.length; i += BATCH) {
    const chunk = lines.slice(i, i + BATCH).map((l) => l.id);
    await prisma.transactionLine.updateMany({
      where: { id: { in: chunk } },
      data: { accountId: toAccountId },
    });
  }
}

async function main() {
  const opts = parseArgs(process.argv);
  const prisma = new PrismaClient();
  const { ensurePaymentAccountCoaLink, ensurePaymentTypeMainGlAccounts } = jiti(
    join(__dirname, '../lib/paymentAccountCoaLink.js'),
  );
  const { recalculateAllAccountBalances } = jiti(join(__dirname, '../lib/accountBalanceService.js'));

  const tenantWhere = opts.tenantId ? { id: opts.tenantId } : {};
  const tenants = await prisma.tenant.findMany({
    where: tenantWhere,
    select: { id: true, name: true },
  });

  if (opts.tenantId && tenants.length === 0) {
    console.error('No tenant for --tenant=', opts.tenantId);
    process.exit(1);
  }

  for (const tenant of tenants) {
    const tenantId = tenant.id;
    console.log('\n---', tenantId, tenant.name || '');

    await ensurePaymentTypeMainGlAccounts(tenantId, prisma);

    const main1110 = await prisma.account.findFirst({
      where: { tenantId, OR: [{ accountCode: '1110' }, { code: '1110' }], isActive: true },
      select: { id: true },
    });
    const group1130 = await prisma.account.findFirst({
      where: { tenantId, OR: [{ accountCode: '1130' }, { code: '1130' }], isActive: true },
      select: { id: true },
    });
    const leaf1130 = group1130?.id
      ? await prisma.account.findFirst({
          where: {
            tenantId,
            parentAccountId: group1130.id,
            isActive: true,
            accountType: 'Asset',
            OR: [{ accountCode: { startsWith: '1130-' } }, { code: { startsWith: '1130-' } }],
          },
          orderBy: [{ accountCode: 'asc' }],
          select: { id: true, accountCode: true },
        })
      : null;

    if (!main1110?.id) {
      console.warn('  No 1110 — skip tenant');
      continue;
    }

    const paymentAccounts = await prisma.paymentAccount.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true, accountType: true, coaAccountId: true },
    });

    for (const pa of paymentAccounts) {
      if (opts.dryRun) {
        if (!pa.coaAccountId) {
          console.log(`  [dry-run] PaymentAccount ${pa.id} (${pa.accountType}) has no coaAccountId — would link`);
          continue;
        }
        const acc = await prisma.account.findFirst({
          where: { id: pa.coaAccountId, tenantId },
          select: { accountCode: true, code: true },
        });
        const c = normCode(acc);
        if (pa.accountType === 'Cash' && c !== '1110') {
          console.log(`  [dry-run] Cash ${pa.id} ${pa.name}: coa ${c} → would set 1110`);
        }
        if (['Bank', 'Mobile Money', 'Wallet', 'POS Terminal'].includes(pa.accountType || '') && c === '1130') {
          console.log(`  [dry-run] ${pa.accountType} ${pa.id}: coa bare 1130 → would create/link 1130-xx`);
        }
        continue;
      }
      try {
        const before = pa.coaAccountId;
        await ensurePaymentAccountCoaLink(tenantId, pa, prisma);
        const after = (
          await prisma.paymentAccount.findUnique({ where: { id: pa.id }, select: { coaAccountId: true } })
        )?.coaAccountId;
        if (after !== before) {
          console.log('  PaymentAccount', pa.id, pa.accountType, before, '->', after);
        }
      } catch (e) {
        console.warn('  ensurePaymentAccountCoaLink', pa.id, e?.message || e);
      }
    }

    if (group1130?.id && leaf1130?.id) {
      await reassignLinesForAccount(
        prisma,
        tenantId,
        group1130.id,
        leaf1130.id,
        `Bare 1130 → ${leaf1130.accountCode}`,
        opts.dryRun,
      );
    } else if (group1130?.id && !leaf1130?.id) {
      console.warn('  Bare 1130 exists but no 1130-xx leaf — create a bank payment account in /payments/management');
    }

    if (opts.mergeCashLines) {
      const legacyAccounts = await prisma.account.findMany({
        where: {
          tenantId,
          isActive: true,
          OR: [{ accountCode: { in: LEGACY_CASH_CODES } }, { code: { in: LEGACY_CASH_CODES } }],
        },
        select: { id: true },
      });
      for (const { id: lid } of legacyAccounts) {
        await reassignLinesForAccount(prisma, tenantId, lid, main1110.id, `Legacy cash ${lid} → 1110`, opts.dryRun);
      }
    }

    if (opts.retireLegacyCashSlots && !opts.dryRun) {
      for (const code of LEGACY_CASH_CODES) {
        const acc = await prisma.account.findFirst({
          where: { tenantId, OR: [{ accountCode: code }, { code: code }], isActive: true },
          select: { id: true, balance: true },
        });
        if (!acc) continue;
        const n = await prisma.transactionLine.count({ where: { accountId: acc.id } });
        if (n === 0 && Math.abs(Number(acc.balance || 0)) < 1e-9) {
          await prisma.account.update({ where: { id: acc.id }, data: { acceptsNewTransactions: false } });
          console.log('  Retired empty', code);
        }
      }
    }

    if (!opts.dryRun) {
      console.log('  recalculateAllAccountBalances…');
      await recalculateAllAccountBalances(tenantId, prisma);
    }
  }

  await prisma.$disconnect();
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
