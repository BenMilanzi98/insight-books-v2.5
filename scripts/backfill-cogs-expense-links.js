#!/usr/bin/env node
/**
 * Backfill Expense.categoryId and Expense.expenseAccountId for COGS-related rows
 * so they align with ExpenseCategory / chart of accounts (no CoA structure changes).
 *
 * Default: dry-run (prints planned updates only).
 * Writes: pass --apply
 *
 * Usage:
 *   node scripts/backfill-cogs-expense-links.js --tenant-id=<cuid>
 *   node scripts/backfill-cogs-expense-links.js --all-tenants
 *   node scripts/backfill-cogs-expense-links.js --tenant-id=<cuid> --apply
 *   node scripts/backfill-cogs-expense-links.js --tenant-id=<cuid> --limit=50
 *
 * npm run backfill:cogs-expense-links -- --tenant-id=...
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const path = require('path');
const { pathToFileURL } = require('url');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const LEGACY_COGS_TEXT_OR = [
  { category: { equals: 'Cost of Goods Sold', mode: 'insensitive' } },
  { category: { equals: 'COGS', mode: 'insensitive' } },
  { category: { equals: 'Cost of Sales', mode: 'insensitive' } },
  { category: { startsWith: 'Cost of Goods', mode: 'insensitive' } },
];

function parseArgs() {
  const raw = process.argv.slice(2);
  const out = {
    apply: false,
    tenantId: null,
    allTenants: false,
    limit: null,
  };
  for (const a of raw) {
    if (a === '--apply') out.apply = true;
    else if (a === '--all-tenants') out.allTenants = true;
    else if (a.startsWith('--tenant-id=')) out.tenantId = a.slice('--tenant-id='.length).trim();
    else if (a.startsWith('--limit=')) {
      const n = parseInt(a.slice('--limit='.length), 10);
      out.limit = Number.isFinite(n) && n > 0 ? n : null;
    } else if (a === '--help' || a === '-h') {
      out.help = true;
    }
  }
  return out;
}

function accountCodeForSort(acc) {
  return String(acc?.accountCode || acc?.code || '').trim();
}

function rankCogsCategoryRow(row) {
  const ac = accountCodeForSort(row.account);
  if (ac === '5110') return [0, ac];
  if (/^511\d/.test(ac)) return [1, ac];
  if (ac === '5100') return [2, ac];
  if (ac >= '5100' && ac <= '5199') return [3, ac];
  if (ac === '5000') return [5, ac];
  return [4, ac];
}

/**
 * Pick one ExpenseCategory row whose linked GL account is in the COGS register set.
 * Prefers 5110 Purchases, then other 511x, then 5100, then other 51xx / named COGS accounts.
 */
async function pickCanonicalCogsExpenseCategory(prismaClient, tenantId, cogsAccountIds) {
  if (!cogsAccountIds.length) return null;
  const rows = await prismaClient.expenseCategory.findMany({
    where: {
      tenantId,
      accountId: { in: cogsAccountIds },
    },
    include: {
      account: {
        select: { id: true, accountCode: true, code: true, accountName: true, name: true, accountType: true },
      },
    },
  });
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => {
    const [ra, sa] = rankCogsCategoryRow(a);
    const [rb, sb] = rankCogsCategoryRow(b);
    if (ra !== rb) return ra - rb;
    return sa.localeCompare(sb);
  });
  return sorted[0];
}

function inferKind(e, cogsIdSet, expenseCategoryLabelLooksLikeCogs) {
  if (!e.expenseAccountId && !e.categoryId && expenseCategoryLabelLooksLikeCogs(e.category)) {
    return 'legacy-free-text';
  }
  if (e.expenseAccountId && !e.categoryId && cogsIdSet.has(e.expenseAccountId)) {
    return 'missing-category-id';
  }
  if (
    !e.expenseAccountId &&
    e.categoryId &&
    e.expenseCategory?.accountId &&
    cogsIdSet.has(e.expenseCategory.accountId)
  ) {
    return 'missing-expense-account-id';
  }
  return null;
}

async function findExpenseCategoriesByAccountId(prismaClient, tenantId, accountId) {
  return prismaClient.expenseCategory.findMany({
    where: { tenantId, accountId },
    select: { id: true, name: true, accountId: true },
    orderBy: { name: 'asc' },
  });
}

async function planUpdatesForTenant(
  prismaClient,
  tenantId,
  cogsAccountIds,
  canonical,
  expenseCategoryLabelLooksLikeCogs
) {
  const cogsIdSet = new Set(cogsAccountIds);
  const whereCandidates = {
    tenantId,
    isDeleted: false,
    OR: [
      {
        AND: [{ expenseAccountId: null }, { categoryId: null }, { OR: LEGACY_COGS_TEXT_OR }],
      },
      {
        AND: [{ categoryId: null }, { expenseAccountId: { in: cogsAccountIds } }],
      },
      {
        AND: [
          { expenseAccountId: null },
          { categoryId: { not: null } },
          { expenseCategory: { is: { accountId: { in: cogsAccountIds } } } },
        ],
      },
    ],
  };

  const rows = await prismaClient.expense.findMany({
    where: whereCandidates,
    select: {
      id: true,
      description: true,
      amount: true,
      date: true,
      category: true,
      categoryId: true,
      expenseAccountId: true,
      expenseCategory: {
        select: { id: true, name: true, accountId: true },
      },
    },
    orderBy: { date: 'desc' },
  });

  const categoryByAccountId = new Map();
  const getCategoriesForAccount = async (accountId) => {
    if (categoryByAccountId.has(accountId)) return categoryByAccountId.get(accountId);
    const m = await findExpenseCategoriesByAccountId(prismaClient, tenantId, accountId);
    categoryByAccountId.set(accountId, m);
    return m;
  };

  const plans = [];
  for (const e of rows) {
    const kind = inferKind(e, cogsIdSet, expenseCategoryLabelLooksLikeCogs);
    if (!kind) continue;

    let nextCategoryId = null;
    let nextExpenseAccountId = null;
    let nextCategoryLabel = null;
    let note = '';

    if (kind === 'legacy-free-text') {
      if (!canonical) {
        plans.push({
          expenseId: e.id,
          kind,
          skip: true,
          reason: 'No ExpenseCategory linked to a COGS register account for this tenant',
          row: e,
        });
        continue;
      }
      nextCategoryId = canonical.id;
      nextExpenseAccountId = canonical.accountId;
      nextCategoryLabel = canonical.name;
    } else if (kind === 'missing-category-id') {
      const matches = await getCategoriesForAccount(e.expenseAccountId);
      if (matches.length >= 1) {
        nextCategoryId = matches[0].id;
        nextExpenseAccountId = e.expenseAccountId;
        nextCategoryLabel = matches[0].name;
        if (matches.length > 1) {
          note = `Multiple ExpenseCategory rows for account ${e.expenseAccountId}; picked "${matches[0].name}"`;
        }
      } else if (canonical) {
        nextCategoryId = canonical.id;
        nextExpenseAccountId = canonical.accountId;
        nextCategoryLabel = canonical.name;
        note = `No ExpenseCategory for expense.expenseAccountId ${e.expenseAccountId}; fell back to canonical COGS category`;
      } else {
        plans.push({
          expenseId: e.id,
          kind,
          skip: true,
          reason: 'No ExpenseCategory row for this expense account and no canonical COGS category',
          row: e,
        });
        continue;
      }
    } else if (kind === 'missing-expense-account-id') {
      nextCategoryId = e.categoryId;
      nextExpenseAccountId = e.expenseCategory.accountId;
      nextCategoryLabel = e.expenseCategory.name;
    }

    const unchanged =
      e.categoryId === nextCategoryId &&
      e.expenseAccountId === nextExpenseAccountId &&
      (nextCategoryLabel == null || e.category === nextCategoryLabel);
    if (unchanged) continue;

    plans.push({
      expenseId: e.id,
      kind,
      skip: false,
      note,
      row: e,
      nextCategoryId,
      nextExpenseAccountId,
      nextCategoryLabel,
    });
  }

  return plans;
}

async function loadEsmLibs() {
  const overlapHref = pathToFileURL(path.join(__dirname, '../lib/expenseRegisterGlCogsOverlap.js')).href;
  const cogsHref = pathToFileURL(path.join(__dirname, '../lib/getCogsAccountIdsForExpenseRegister.js')).href;
  const [overlap, cogsMod] = await Promise.all([import(overlapHref), import(cogsHref)]);
  return {
    expenseCategoryLabelLooksLikeCogs: overlap.expenseCategoryLabelLooksLikeCogs,
    getCogsAccountIdsForExpenseRegister: cogsMod.getCogsAccountIdsForExpenseRegister,
  };
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    console.log(`
Backfill COGS Expense links (categoryId + expenseAccountId)

  --tenant-id=<id>   Process one tenant (required unless --all-tenants)
  --all-tenants      Process every tenant
  --apply            Perform updates (default: dry-run only)
  --limit=<n>        Max rows to show / apply per tenant (optional safety cap)
`);
    process.exit(0);
  }

  if (!args.tenantId && !args.allTenants) {
    console.error('Provide --tenant-id=<id> or --all-tenants. Use --help for usage.');
    process.exit(1);
  }

  const { expenseCategoryLabelLooksLikeCogs, getCogsAccountIdsForExpenseRegister } = await loadEsmLibs();

  const tenants = args.allTenants
    ? await prisma.tenant.findMany({ select: { id: true, name: true, subdomain: true } })
    : await prisma.tenant.findMany({
        where: { id: args.tenantId },
        select: { id: true, name: true, subdomain: true },
      });

  if (!tenants.length) {
    console.error('No tenant found for the given --tenant-id.');
    process.exit(1);
  }

  console.log(
    args.apply ? '\n*** APPLY MODE — database will be updated ***\n' : '\n*** DRY RUN — no writes ***\n'
  );

  let totalPlanned = 0;
  let totalApplied = 0;

  for (const tenant of tenants) {
    console.log('---');
    console.log(`Tenant: ${tenant.name} (${tenant.id})${tenant.subdomain ? ` [${tenant.subdomain}]` : ''}`);

    const cogsAccountIds = await getCogsAccountIdsForExpenseRegister(prisma, tenant.id);
    const canonical = await pickCanonicalCogsExpenseCategory(prisma, tenant.id, cogsAccountIds);

    if (!canonical) {
      console.log(
        cogsAccountIds.length
          ? '  No ExpenseCategory rows point at COGS register accounts; nothing to link. Add or map expense categories first.'
          : '  No COGS register accounts found for tenant; skip.'
      );
      continue;
    }

    console.log(
      `  Canonical COGS ExpenseCategory: "${canonical.name}" → account ${accountCodeForSort(canonical.account) || '(no code)'} (${canonical.accountId})`
    );

    let plans = await planUpdatesForTenant(
      prisma,
      tenant.id,
      cogsAccountIds,
      canonical,
      expenseCategoryLabelLooksLikeCogs
    );
    const skipped = plans.filter((p) => p.skip);
    plans = plans.filter((p) => !p.skip);

    if (skipped.length) {
      console.log(`  Skipped ${skipped.length} row(s) (see reasons below):`);
      skipped.slice(0, 20).forEach((s) => {
        console.log(`    - ${s.expenseId} [${s.kind}] ${s.reason}`);
      });
      if (skipped.length > 20) console.log(`    ... and ${skipped.length - 20} more`);
    }

    if (!plans.length) {
      console.log('  No backfill actions needed.');
      continue;
    }

    totalPlanned += plans.length;
    const toRun = args.limit ? plans.slice(0, args.limit) : plans;
    if (args.limit && plans.length > args.limit) {
      console.log(`  Showing / applying first ${args.limit} of ${plans.length} planned update(s).`);
    }

    console.log(`  Planned updates: ${toRun.length}`);
    toRun.slice(0, 30).forEach((p) => {
      const r = p.row;
      console.log(
        `    ${p.expenseId} [${p.kind}] date=${r.date?.toISOString?.().slice(0, 10)} amount=${r.amount} "${(r.description || '').slice(0, 40)}"`
      );
      console.log(
        `      category: "${r.category}" | categoryId: ${r.categoryId || 'null'} | expenseAccountId: ${r.expenseAccountId || 'null'}`
      );
      console.log(
        `      → categoryId: ${p.nextCategoryId} expenseAccountId: ${p.nextExpenseAccountId} category label: "${p.nextCategoryLabel}"`
      );
      if (p.note) console.log(`      note: ${p.note}`);
    });
    if (toRun.length > 30) console.log(`    ... and ${toRun.length - 30} more (omitted from log)`);

    if (args.apply) {
      const CHUNK = 50;
      for (let i = 0; i < toRun.length; i += CHUNK) {
        const slice = toRun.slice(i, i + CHUNK);
        await prisma.$transaction(
          slice.map((p) =>
            prisma.expense.update({
              where: { id: p.expenseId },
              data: {
                categoryId: p.nextCategoryId,
                expenseAccountId: p.nextExpenseAccountId,
                ...(p.nextCategoryLabel ? { category: p.nextCategoryLabel } : {}),
              },
            })
          )
        );
      }
      totalApplied += toRun.length;
      console.log(`  Applied ${toRun.length} update(s).`);
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Planned actionable updates (this run): ${totalPlanned}`);
  if (args.apply) console.log(`Applied: ${totalApplied}`);
  else console.log('Re-run with --apply to write changes.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
