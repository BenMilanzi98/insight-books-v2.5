#!/usr/bin/env node
/**
 * CoA V2 — backfill standard purpose → account mappings (Phase 3 sole source of truth).
 *
 * For each tenant, resolves accounts via existing helpers / blueprint codes and ensures
 * ACTIVE CoaV2AccountMapping rows exist (default scope: * / * / * / *).
 *
 * Usage (requires @/ alias loader):
 *   node --import ./scripts/registerAliasLoader.mjs scripts/coa-v2-backfill-purpose-mappings.mjs --dry-run
 *   node --import ./scripts/registerAliasLoader.mjs scripts/coa-v2-backfill-purpose-mappings.mjs --apply
 *   node --import ./scripts/registerAliasLoader.mjs scripts/coa-v2-backfill-purpose-mappings.mjs --apply --business <tenantId>
 *
 * Idempotent. Default is dry-run when neither flag is passed.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createAccountingContext } from '../lib/accountingV2/domain/accountingContext.js';
import { assignMapping } from '../lib/coaV2/application/accountMappingRegistry.js';
import {
  STANDARD_PURPOSE_MAPPINGS,
  getPurposeMappingReadiness,
  validateCoaFkIntegrity,
} from '../lib/coaV2/application/purposeMappingReadiness.js';
import {
  findAccountsPayableGlAccount,
  findAccountsReceivableGlAccount,
  findDefaultInvoiceRevenueAccount,
  CODE_SERVICE_REVENUE,
  CODE_SERVICE_REVENUE_LEGACY,
} from '../lib/coaPostingCodes.js';
import { resolveInventoryGlAccount } from '../lib/inventoryGlAccount.js';
import { resolveCogsPostingLeafGlAccount } from '../lib/cogsGlAccount.js';
import { SYSTEM_ACCOUNT_PURPOSES } from '../lib/coaV2/domain/systemPurposes.js';

function parseArgs(argv) {
  const args = { apply: false, dryRun: true, tenantId: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--apply') {
      args.apply = true;
      args.dryRun = false;
    } else if (argv[i] === '--dry-run') {
      args.dryRun = true;
      args.apply = false;
    } else if (argv[i] === '--business') {
      args.tenantId = argv[++i];
    }
  }
  return args;
}

async function findByCode(db, tenantId, code) {
  if (!code) return null;
  return db.account.findFirst({
    where: {
      tenantId,
      isActive: true,
      OR: [{ accountCode: String(code) }, { code: String(code) }],
    },
  });
}

async function findBankPostingLeaf(db, tenantId) {
  const group = await findByCode(db, tenantId, '1130');
  if (group?.id) {
    const child = await db.account.findFirst({
      where: {
        tenantId,
        parentAccountId: group.id,
        isActive: true,
        accountType: 'Asset',
      },
      orderBy: { accountCode: 'asc' },
    });
    if (child) return child;
  }
  for (const code of ['1131', '1132', '1133']) {
    const acc = await findByCode(db, tenantId, code);
    if (!acc) continue;
    const childCount = await db.account.count({
      where: { tenantId, parentAccountId: acc.id, isActive: true },
    });
    if (childCount === 0) return acc;
    const leaf = await db.account.findFirst({
      where: { tenantId, parentAccountId: acc.id, isActive: true, accountType: 'Asset' },
      orderBy: { accountCode: 'asc' },
    });
    if (leaf) return leaf;
  }
  return null;
}

async function findServiceRevenue(db, tenantId) {
  return (
    (await findByCode(db, tenantId, CODE_SERVICE_REVENUE)) ||
    (await findByCode(db, tenantId, CODE_SERVICE_REVENUE_LEGACY))
  );
}

/** Prefer a posting leaf under a header/parent account. */
async function preferPostingLeaf(db, tenantId, account) {
  if (!account?.id) return null;
  const child = await db.account.findFirst({
    where: {
      tenantId,
      parentAccountId: account.id,
      isActive: true,
      OR: [{ coaV2Behaviour: { in: ['POSTING', 'SYSTEM'] } }, { coaV2Behaviour: null }],
    },
    orderBy: { accountCode: 'asc' },
  });
  return child || account;
}

/**
 * Resolve an existing Account for a purpose — never creates accounts.
 * @returns {Promise<{id: string, accountCode?: string|null, accountName?: string|null}|null>}
 */
async function resolveAccountForPurpose(db, tenantId, purpose) {
  const legacyCode = SYSTEM_ACCOUNT_PURPOSES[purpose]?.legacyCode;

  switch (purpose) {
    case 'CASH_ON_HAND':
      return (await findByCode(db, tenantId, '1110')) || (await findByCode(db, tenantId, '1010'));
    case 'PETTY_CASH':
      return findByCode(db, tenantId, legacyCode || '1120');
    case 'PRIMARY_BANK':
      return findBankPostingLeaf(db, tenantId);
    case 'MOBILE_MONEY': {
      const mm =
        (await findByCode(db, tenantId, '1140')) ||
        (await findByCode(db, tenantId, '1141'));
      return preferPostingLeaf(db, tenantId, mm);
    }
    case 'ACCOUNTS_RECEIVABLE':
      return findAccountsReceivableGlAccount(tenantId, db);
    case 'ACCOUNTS_PAYABLE':
      return findAccountsPayableGlAccount(tenantId, db);
    case 'INVENTORY':
      return resolveInventoryGlAccount(tenantId, db);
    case 'SALES_REVENUE':
      return (
        (await findDefaultInvoiceRevenueAccount(tenantId, db)) ||
        (await findByCode(db, tenantId, '4100'))
      );
    case 'SERVICE_REVENUE':
      return findServiceRevenue(db, tenantId);
    case 'COST_OF_SALES':
      return (
        (await resolveCogsPostingLeafGlAccount(tenantId, db)) ||
        (await findByCode(db, tenantId, '5100'))
      );
    case 'VAT_OUTPUT': {
      const vat =
        (await findByCode(db, tenantId, '2042')) ||
        (await findByCode(db, tenantId, legacyCode || '2041'));
      return preferPostingLeaf(db, tenantId, vat);
    }
    case 'VAT_INPUT': {
      const vatIn =
        (await findByCode(db, tenantId, '1150')) ||
        (await findByCode(db, tenantId, '2043')) ||
        (await findByCode(db, tenantId, '1410')) ||
        (await findByCode(db, tenantId, '2041-02')) ||
        (await findByCode(db, tenantId, '2042'));
      if (vatIn) return preferPostingLeaf(db, tenantId, vatIn);
      // Last resort: first posting child under VAT control account 2041
      const header = await findByCode(db, tenantId, '2041');
      return preferPostingLeaf(db, tenantId, header);
    }
    case 'WITHHOLDING_TAX_PAYABLE': {
      const wht = await findByCode(db, tenantId, legacyCode || '2045');
      return preferPostingLeaf(db, tenantId, wht);
    }
    case 'SALARIES_AND_WAGES':
    case 'OWNER_CAPITAL':
    case 'RETAINED_EARNINGS':
      return findByCode(db, tenantId, legacyCode);
    case 'OPENING_BALANCE_EQUITY':
      return (
        (await findByCode(db, tenantId, legacyCode)) ||
        (await findByCode(db, tenantId, '3900')) ||
        (await findByCode(db, tenantId, '3999'))
      );
    default:
      return legacyCode ? findByCode(db, tenantId, legacyCode) : null;
  }
}

async function ensureMapping(db, context, purpose, account, { apply }) {
  const existing = await db.coaV2AccountMapping.findUnique({
    where: {
      tenantId_purpose_moduleKey_transactionType_currency_branchKey: {
        tenantId: context.businessId,
        purpose,
        moduleKey: '*',
        transactionType: '*',
        currency: '*',
        branchKey: '*',
      },
    },
  });

  if (existing?.status === 'ACTIVE' && existing.accountId === account.id) {
    return { action: 'unchanged', mappingId: existing.id };
  }

  if (!apply) {
    return {
      action: existing ? 'would_update' : 'would_create',
      mappingId: existing?.id ?? null,
      accountId: account.id,
    };
  }

  try {
    const { mapping, previous } = await assignMapping({
      db,
      context,
      purpose,
      accountId: account.id,
      scope: {},
      approvedBy: context.userId,
    });
    return {
      action: previous ? 'updated' : 'created',
      mappingId: mapping.id,
      via: 'assignMapping',
    };
  } catch (err) {
    // assignMapping validates V2 classification; fall back to direct upsert so
    // operational mappings can land before/alongside Stage-2 classify.
    const key = {
      tenantId: context.businessId,
      purpose,
      moduleKey: '*',
      transactionType: '*',
      currency: '*',
      branchKey: '*',
    };
    const mapping = await db.coaV2AccountMapping.upsert({
      where: { tenantId_purpose_moduleKey_transactionType_currency_branchKey: key },
      create: {
        ...key,
        accountId: account.id,
        status: 'ACTIVE',
        createdBy: context.userId,
        approvedBy: context.userId,
      },
      update: {
        accountId: account.id,
        status: 'ACTIVE',
        updatedBy: context.userId,
        approvedBy: context.userId,
      },
    });
    return {
      action: 'upserted_fallback',
      mappingId: mapping.id,
      via: 'prisma',
      warning: err?.message || String(err),
    };
  }
}

async function backfillTenant(db, tenant, { apply }) {
  const context = createAccountingContext({
    businessId: tenant.id,
    userId: 'system-coa-purpose-backfill',
    sourceChannel: 'job',
  });

  const results = [];
  for (const purpose of STANDARD_PURPOSE_MAPPINGS) {
    const account = await resolveAccountForPurpose(db, tenant.id, purpose);
    if (!account?.id) {
      results.push({ purpose, action: 'missing_account', accountId: null });
      continue;
    }
    const outcome = await ensureMapping(db, context, purpose, account, { apply });
    results.push({
      purpose,
      accountId: account.id,
      accountCode: account.accountCode ?? account.code ?? null,
      accountName: account.accountName ?? account.name ?? null,
      ...outcome,
    });
  }

  const readiness = await getPurposeMappingReadiness(tenant.id, db);
  const fk = await validateCoaFkIntegrity(tenant.id, db);
  return { tenantId: tenant.id, tenantName: tenant.name, results, readiness, fk };
}

async function main() {
  const args = parseArgs(process.argv);
  const mode = args.apply ? 'APPLY' : 'DRY RUN';
  console.log(`\n▶ CoA V2 purpose-mapping backfill (${mode})`);
  if (!args.apply) {
    console.log('  (pass --apply to write mappings; --dry-run is default)\n');
  }

  const prisma = new PrismaClient();
  try {
    const tenants = await prisma.tenant.findMany({
      where: args.tenantId ? { id: args.tenantId } : {},
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    if (tenants.length === 0) {
      console.log('No tenants found.');
      process.exitCode = 1;
      return;
    }

    const summaries = [];
    for (const tenant of tenants) {
      console.log(`\n── ${tenant.name || tenant.id} (${tenant.id})`);
      const report = await backfillTenant(prisma, tenant, { apply: args.apply });

      for (const r of report.results) {
        const code = r.accountCode ? ` [${r.accountCode}]` : '';
        const warn = r.warning ? ` ⚠ ${r.warning}` : '';
        console.log(`  ${r.purpose}: ${r.action}${code}${warn}`);
      }

      const { readiness, fk } = report;
      console.log(
        `  Readiness: ${readiness.mapped.length}/${readiness.purposes.length} mapped` +
          (readiness.missing.length
            ? ` — missing: ${readiness.missing.join(', ')}`
            : ' — READY')
      );
      if (!fk.ok) {
        console.log(
          `  FK soft: ${fk.paymentAccountsMissingCoa.length} PaymentAccount(s) without coaAccountId; ` +
            `${fk.expenseCategoriesMissingAccount.length} ExpenseCategory missing accountId; ` +
            `${fk.expenseCategoriesOrphanAccount.length} orphan ExpenseCategory accountId(s)`
        );
      }

      summaries.push({
        tenant: tenant.name || tenant.id,
        mapped: readiness.mapped.length,
        missing: readiness.missing.length,
        ready: readiness.ready,
        fkOk: fk.ok,
      });
    }

    console.log('\n══ Summary');
    console.table(summaries);
    const notReady = summaries.filter((s) => !s.ready).length;
    console.log(
      `\n${summaries.length - notReady}/${summaries.length} tenant(s) have all standard purposes mapped.`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
