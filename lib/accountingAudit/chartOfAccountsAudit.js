/**
 * Chart of Accounts forensic audit — duplicate codes, purpose collisions,
 * hierarchy defects, parent-posting hazards, inactive-account postings.
 * READ-ONLY.
 */

import { SEVERITY, CONFIDENCE, POSTED_STATUSES, makeFinding } from './findings.js';

const VALID_TYPES = new Set([
  'Asset',
  'Liability',
  'Equity',
  'Revenue',
  'Income',
  'Expense',
  'Cost of Sales',
]);

// Purpose families where multiple active accounts usually signal duplication
const PURPOSE_PATTERNS = [
  { purpose: 'salaries', regex: /salar|wages|payroll expense/i, type: 'Expense' },
  { purpose: 'accounts_receivable', regex: /accounts receivable/i, type: 'Asset' },
  { purpose: 'accounts_payable', regex: /accounts payable/i, type: 'Liability' },
  { purpose: 'owner_capital', regex: /owner.?s? capital|share capital/i, type: 'Equity' },
  { purpose: 'retained_earnings', regex: /retained earnings/i, type: 'Equity' },
  { purpose: 'current_year_profit', regex: /current year (earnings|profit)/i, type: 'Equity' },
  { purpose: 'vat_control', regex: /vat (payable|receivable|control)/i, type: null },
];

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ tenantId?: string|null }} scope
 */
export async function runChartOfAccountsAudit(prisma, scope = {}) {
  const findings = [];

  const accounts = await prisma.account.findMany({
    where: { ...(scope.tenantId ? { tenantId: scope.tenantId } : {}) },
    select: {
      id: true,
      tenantId: true,
      accountCode: true,
      accountName: true,
      accountType: true,
      normalBalance: true,
      parentAccountId: true,
      isActive: true,
      isSystem: true,
      acceptsNewTransactions: true,
      mergedIntoAccountId: true,
      balance: true,
    },
  });

  const byTenant = new Map();
  for (const a of accounts) {
    if (!byTenant.has(a.tenantId)) byTenant.set(a.tenantId, []);
    byTenant.get(a.tenantId).push(a);
  }

  for (const [tenantId, list] of byTenant) {
    const byId = new Map(list.map((a) => [a.id, a]));

    // Duplicate codes (unique constraint exists, but verify + catch NULL-code collisions by name)
    const codeCount = new Map();
    for (const a of list) {
      if (!a.accountCode) continue;
      const key = a.accountCode;
      codeCount.set(key, (codeCount.get(key) || []).concat(a));
    }
    for (const [code, dupes] of codeCount) {
      if (dupes.length > 1) {
        findings.push(
          makeFinding({
            ruleCode: 'COA-001',
            severity: SEVERITY.HIGH,
            category: 'chart_of_accounts',
            tenantId,
            entityType: 'Account',
            entityId: dupes.map((d) => d.id).join(','),
            description: `Duplicate account code ${code}: ${dupes.map((d) => d.accountName).join(' | ')}`,
          })
        );
      }
    }

    // Accounts with NULL code or name
    for (const a of list) {
      if (!a.accountCode || !a.accountName) {
        findings.push(
          makeFinding({
            ruleCode: 'COA-004',
            severity: SEVERITY.MEDIUM,
            category: 'chart_of_accounts',
            tenantId,
            entityType: 'Account',
            entityId: a.id,
            description: `Account missing ${!a.accountCode ? 'code' : 'name'} (schema allows NULL).`,
            evidence: { accountCode: a.accountCode, accountName: a.accountName },
          })
        );
      }
      if (a.accountType && !VALID_TYPES.has(a.accountType)) {
        findings.push(
          makeFinding({
            ruleCode: 'COA-004',
            severity: SEVERITY.MEDIUM,
            category: 'chart_of_accounts',
            tenantId,
            entityType: 'Account',
            entityId: a.id,
            description: `Account ${a.accountCode} ${a.accountName} has unrecognized type "${a.accountType}".`,
          })
        );
      }
    }

    // Parent-child cycles
    for (const a of list) {
      const seen = new Set([a.id]);
      let cur = a.parentAccountId ? byId.get(a.parentAccountId) : null;
      while (cur) {
        if (seen.has(cur.id)) {
          findings.push(
            makeFinding({
              ruleCode: 'COA-007',
              severity: SEVERITY.HIGH,
              category: 'chart_of_accounts',
              tenantId,
              entityType: 'Account',
              entityId: a.id,
              description: `Parent-child cycle involving ${a.accountCode} ${a.accountName}.`,
            })
          );
          break;
        }
        seen.add(cur.id);
        cur = cur.parentAccountId ? byId.get(cur.parentAccountId) : null;
      }
      // Orphan parent reference
      if (a.parentAccountId && !byId.has(a.parentAccountId)) {
        findings.push(
          makeFinding({
            ruleCode: 'COA-007',
            severity: SEVERITY.MEDIUM,
            category: 'chart_of_accounts',
            tenantId,
            entityType: 'Account',
            entityId: a.id,
            description: `Account ${a.accountCode} ${a.accountName} references a parent that does not exist in this tenant.`,
            evidence: { parentAccountId: a.parentAccountId },
          })
        );
      }
    }

    // Purpose duplicates (active accounts only, exclude merged-away rows)
    for (const { purpose, regex, type } of PURPOSE_PATTERNS) {
      const matches = list.filter(
        (a) =>
          a.isActive &&
          !a.mergedIntoAccountId &&
          a.accountName &&
          regex.test(a.accountName) &&
          (!type || a.accountType === type)
      );
      if (matches.length > 1) {
        findings.push(
          makeFinding({
            ruleCode: 'COA-002',
            severity: SEVERITY.HIGH,
            category: 'chart_of_accounts',
            tenantId,
            entityType: 'Account',
            entityId: matches.map((m) => m.id).join(','),
            confidence: CONFIDENCE.REVIEW,
            description:
              `Multiple active accounts may serve the same purpose (${purpose}): ` +
              matches.map((m) => `${m.accountCode} ${m.accountName}`).join(' | '),
            recommendation: 'Phase 2: confirm intent; consolidate via controlled remap if duplicated.',
          })
        );
      }
    }
  }

  // Postings to header/parent accounts (accounts with active children)
  const parentPostings = await prisma.$queryRaw`
    SELECT a.id, a."tenantId", a."accountCode", a."accountName",
           COUNT(tl.id)::int AS line_count
    FROM "Account" a
    JOIN "TransactionLine" tl ON tl."accountId" = a.id
    WHERE EXISTS (SELECT 1 FROM "Account" c WHERE c."parentAccountId" = a.id AND c."isActive" = true)
    GROUP BY a.id`;
  for (const row of parentPostings) {
    findings.push(
      makeFinding({
        ruleCode: 'COA-003',
        severity: SEVERITY.HIGH,
        category: 'chart_of_accounts',
        tenantId: row.tenantId,
        entityType: 'Account',
        entityId: row.id,
        description: `Parent account ${row.accountCode} ${row.accountName} has ${row.line_count} direct posting lines while also having active children.`,
        recommendation: 'Phase 2: repoint direct postings to leaf accounts or designate account as posting-eligible.',
      })
    );
  }

  // Inactive accounts still receiving posted lines
  const inactivePostings = await prisma.$queryRaw`
    SELECT a.id, a."tenantId", a."accountCode", a."accountName", COUNT(tl.id)::int AS line_count
    FROM "Account" a
    JOIN "TransactionLine" tl ON tl."accountId" = a.id
    JOIN "Transaction" t ON t.id = tl."transactionId"
    WHERE a."isActive" = false AND lower(t.status) = 'posted'
    GROUP BY a.id`;
  for (const row of inactivePostings) {
    findings.push(
      makeFinding({
        ruleCode: 'COA-006',
        severity: SEVERITY.MEDIUM,
        category: 'chart_of_accounts',
        tenantId: row.tenantId,
        entityType: 'Account',
        entityId: row.id,
        description: `Inactive account ${row.accountCode} ${row.accountName} carries ${row.line_count} posted lines.`,
        confidence: CONFIDENCE.REVIEW,
      })
    );
  }

  return { findings, accounts };
}
