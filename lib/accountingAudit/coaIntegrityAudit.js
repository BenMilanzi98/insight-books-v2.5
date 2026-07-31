/**
 * CoA V2 integrity audit — COA-001..COA-025 (Phase 3 §35). READ-ONLY.
 *
 * Complements the Phase 1 chartOfAccountsAudit with checks over the V2
 * governance data (classifications, purposes, mappings, aliases, lifecycle).
 */

import { SEVERITY, CONFIDENCE, makeFinding } from './findings.js';
import { validateClassification, CATEGORY_SUBTYPES } from '../coaV2/domain/categories.js';
import { SYSTEM_ACCOUNT_PURPOSES, validateAccountForPurpose } from '../coaV2/domain/systemPurposes.js';
import { CATEGORY_ALLOWED_SECTIONS } from '../coaV2/domain/financialStatementMapping.js';
import { findCycles, buildHierarchyIndex, getDepth } from '../coaV2/domain/hierarchy.js';
import { DEFAULT_MAX_DEPTH } from '../coaV2/domain/hierarchy.js';
import { AccountCurrencyPolicy } from '../coaV2/domain/behaviours.js';

const CAT = 'chart_of_accounts_v2';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ tenantId?: string|null }} scope
 */
export async function runCoaIntegrityAudit(prisma, scope = {}) {
  const findings = [];
  const tenantWhere = scope.tenantId ? { tenantId: scope.tenantId } : {};

  const accounts = await prisma.account.findMany({
    where: { ...tenantWhere },
    select: {
      id: true, tenantId: true, accountCode: true, code: true, accountName: true, name: true,
      accountType: true, isActive: true, isSystem: true, acceptsNewTransactions: true,
      parentAccountId: true, mergedIntoAccountId: true, replacementAccountId: true,
      coaV2Category: true, coaV2SubType: true, coaV2Behaviour: true, coaV2NormalBalance: true,
      coaV2Status: true, postingAllowed: true, manualPostingAllowed: true,
      systemPurpose: true, controlAccountPurpose: true, financialStatementSection: true,
      currencyPolicy: true, specificCurrency: true,
    },
  });
  const mappings = await prisma.coaV2AccountMapping.findMany({
    where: { ...tenantWhere, status: 'ACTIVE' },
  });
  const aliases = await prisma.coaV2AccountAlias.findMany({ where: { ...tenantWhere } });

  const byTenant = new Map();
  for (const a of accounts) {
    const key = a.tenantId ?? '__NULL__';
    if (!byTenant.has(key)) byTenant.set(key, []);
    byTenant.get(key).push(a);
  }
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const aliasCodes = new Set(aliases.map((al) => `${al.tenantId}:${al.aliasCode}`));

  // COA-012: accounts without business scope
  for (const a of accounts) {
    if (a.tenantId == null) {
      findings.push(makeFinding({
        ruleCode: 'COA-012', severity: SEVERITY.HIGH, category: CAT, tenantId: null,
        entityType: 'Account', entityId: a.id,
        description: `Account ${a.accountCode ?? a.code ?? a.id} has no business scope (tenantId NULL)`,
        recommendation: 'Assign the account to its business before constraint tightening',
      }));
    }
  }

  // COA-024: historical accounts hard-deleted (dangling references)
  const referencedIds = await prisma.transactionLine.groupBy({ by: ['accountId'], _count: { _all: true } });
  for (const ref of referencedIds) {
    if (ref.accountId && !accountById.has(ref.accountId) && !scope.tenantId) {
      findings.push(makeFinding({
        ruleCode: 'COA-024', severity: SEVERITY.CRITICAL, category: CAT,
        entityType: 'Account', entityId: ref.accountId,
        description: `Transaction lines reference account ${ref.accountId} which no longer exists (hard delete of historical account)`,
        recommendation: 'Restore the account row from backup; forbid hard deletes',
      }));
    }
  }

  for (const [tenantKey, list] of byTenant) {
    const tenantId = tenantKey === '__NULL__' ? null : tenantKey;
    const index = buildHierarchyIndex(list);
    const activeChildrenOf = new Set(
      list.filter((a) => a.parentAccountId && a.isActive !== false).map((a) => a.parentAccountId)
    );

    // COA-001: duplicate account codes within the business
    const byCode = new Map();
    for (const a of list) {
      const c = a.accountCode ?? a.code;
      if (!c) continue;
      if (!byCode.has(c)) byCode.set(c, []);
      byCode.get(c).push(a);
    }
    for (const [c, rows] of byCode) {
      if (rows.length > 1) {
        findings.push(makeFinding({
          ruleCode: 'COA-001', severity: SEVERITY.HIGH, category: CAT, tenantId,
          entityType: 'Account', entityId: rows.map((r) => r.id).join(','),
          description: `Duplicate account code ${c} used by ${rows.length} accounts`,
          recommendation: 'Consolidate via a consolidation plan; codes must be unique per business',
        }));
      }
    }

    // COA-002: duplicate system-purpose assignment
    const byPurpose = new Map();
    for (const a of list) {
      if (!a.systemPurpose || a.isActive === false || a.coaV2Status === 'ARCHIVED') continue;
      if (!byPurpose.has(a.systemPurpose)) byPurpose.set(a.systemPurpose, []);
      byPurpose.get(a.systemPurpose).push(a);
    }
    for (const [purpose, rows] of byPurpose) {
      if (rows.length > 1) {
        findings.push(makeFinding({
          ruleCode: 'COA-002', severity: SEVERITY.CRITICAL, category: CAT, tenantId,
          entityType: 'Account', entityId: rows.map((r) => r.id).join(','),
          description: `System purpose ${purpose} assigned to ${rows.length} active accounts`,
          recommendation: 'Exactly one active account may hold a system purpose per business',
        }));
      }
    }

    // COA-007: parent-child cycles
    for (const cycle of findCycles(list)) {
      findings.push(makeFinding({
        ruleCode: 'COA-007', severity: SEVERITY.CRITICAL, category: CAT, tenantId,
        entityType: 'Account', entityId: cycle.join(','),
        description: `Account hierarchy cycle detected: ${cycle.join(' → ')}`,
        recommendation: 'Break the cycle by reassigning one parent',
      }));
    }

    for (const a of list) {
      const code = a.accountCode ?? a.code ?? a.id;
      const hasChildren = activeChildrenOf.has(a.id);

      // COA-003: posting enabled on header account
      if ((a.coaV2Behaviour === 'HEADER' || hasChildren) && a.postingAllowed === true) {
        findings.push(makeFinding({
          ruleCode: 'COA-003', severity: SEVERITY.HIGH, category: CAT, tenantId,
          entityType: 'Account', entityId: a.id,
          description: `Header/parent account ${code} has postingAllowed=true`,
          recommendation: 'Headers are presentation-only; disable posting',
        }));
      }

      // COA-004: invalid normal balance vs category/subtype
      if (a.coaV2Category && a.coaV2NormalBalance) {
        const check = validateClassification({
          category: a.coaV2Category, subType: a.coaV2SubType, normalBalance: a.coaV2NormalBalance,
        });
        if (!check.valid) {
          findings.push(makeFinding({
            ruleCode: 'COA-004', severity: SEVERITY.HIGH, category: CAT, tenantId,
            entityType: 'Account', entityId: a.id,
            description: `Account ${code}: ${check.errors.join('; ')}`,
            recommendation: 'Correct the classification through the restricted-update workflow',
          }));
        }
      }

      // COA-005: cross-business parent
      if (a.parentAccountId) {
        const parent = accountById.get(a.parentAccountId);
        if (parent && parent.tenantId !== a.tenantId) {
          findings.push(makeFinding({
            ruleCode: 'COA-005', severity: SEVERITY.CRITICAL, category: CAT, tenantId,
            entityType: 'Account', entityId: a.id,
            description: `Account ${code} has a parent in another business (${parent.tenantId})`,
            recommendation: 'Reassign to a parent within the same business',
          }));
        }
      }

      // COA-013: posting account with children
      if (a.coaV2Behaviour === 'POSTING' && hasChildren) {
        findings.push(makeFinding({
          ruleCode: 'COA-013', severity: SEVERITY.MEDIUM, category: CAT, tenantId,
          entityType: 'Account', entityId: a.id,
          description: `Posting account ${code} has active child accounts`,
          recommendation: 'Convert to header or move the children',
        }));
      }

      // COA-014: invalid currency configuration
      if (a.currencyPolicy === AccountCurrencyPolicy.SPECIFIC_CURRENCY && !a.specificCurrency) {
        findings.push(makeFinding({
          ruleCode: 'COA-014', severity: SEVERITY.MEDIUM, category: CAT, tenantId,
          entityType: 'Account', entityId: a.id,
          description: `Account ${code} declares SPECIFIC_CURRENCY without a currency`,
          recommendation: 'Set specificCurrency or change the policy',
        }));
      }

      // COA-009: wrong financial-statement mapping
      if (a.coaV2Category && a.financialStatementSection) {
        const allowed = CATEGORY_ALLOWED_SECTIONS[a.coaV2Category] ?? [];
        if (!allowed.includes(a.financialStatementSection)) {
          findings.push(makeFinding({
            ruleCode: 'COA-009', severity: SEVERITY.HIGH, category: CAT, tenantId,
            entityType: 'Account', entityId: a.id,
            description: `Account ${code} maps to section ${a.financialStatementSection}, incompatible with category ${a.coaV2Category}`,
            recommendation: 'Correct the financial-statement mapping',
          }));
        }
      }

      // COA-018: equity account mapped as revenue (classification contradiction)
      if (a.coaV2Category === 'EQUITY' && a.financialStatementSection === 'REVENUE') {
        findings.push(makeFinding({
          ruleCode: 'COA-018', severity: SEVERITY.CRITICAL, category: CAT, tenantId,
          entityType: 'Account', entityId: a.id,
          description: `Equity account ${code} is mapped into the revenue section`,
          recommendation: 'Equity movements are never revenue; fix the mapping',
        }));
      }

      // COA-019: liability without proper classification
      if (a.coaV2Category === 'LIABILITY' && a.coaV2SubType &&
          !CATEGORY_SUBTYPES.LIABILITY.includes(a.coaV2SubType)) {
        findings.push(makeFinding({
          ruleCode: 'COA-019', severity: SEVERITY.MEDIUM, category: CAT, tenantId,
          entityType: 'Account', entityId: a.id,
          description: `Liability account ${code} has invalid subtype ${a.coaV2SubType}`,
          recommendation: 'Classify as current or long-term liability',
        }));
      }

      // COA-020: parent+child double-count risk (parent has own posted activity AND children)
      if (hasChildren && a.acceptsNewTransactions !== false && a.coaV2Behaviour !== 'HEADER') {
        findings.push(makeFinding({
          ruleCode: 'COA-020', severity: SEVERITY.HIGH, category: CAT, tenantId,
          entityType: 'Account', entityId: a.id,
          confidence: CONFIDENCE.HIGHLY_LIKELY,
          description: `Parent account ${code} still accepts direct postings while children exist — reports may double-count (CAP-002 pattern)`,
          recommendation: 'Mark as HEADER; derive its balance from descendants only',
        }));
      }

      // COA-021: account code changed without alias (replacement chains must keep the old code reachable)
      if (a.coaV2Status === 'DEPRECATED' && a.replacementAccountId) {
        const key = `${a.tenantId}:${a.accountCode ?? a.code}`;
        if ((a.accountCode ?? a.code) && !aliasCodes.has(key)) {
          findings.push(makeFinding({
            ruleCode: 'COA-021', severity: SEVERITY.MEDIUM, category: CAT, tenantId,
            entityType: 'Account', entityId: a.id,
            description: `Deprecated account ${code} has a replacement but no alias preserving its code`,
            recommendation: 'Create an alias so imports/reports keep resolving the old code',
          }));
        }
      }

      // COA-022: system account without protection
      if ((a.coaV2Behaviour === 'SYSTEM' || a.isSystem) && a.systemPurpose &&
          SYSTEM_ACCOUNT_PURPOSES[a.systemPurpose]?.manualPostingRestricted &&
          a.manualPostingAllowed === true) {
        findings.push(makeFinding({
          ruleCode: 'COA-022', severity: SEVERITY.HIGH, category: CAT, tenantId,
          entityType: 'Account', entityId: a.id,
          description: `System account ${code} (${a.systemPurpose}) allows unrestricted manual posting`,
          recommendation: 'Restrict manual postings; require elevated permission',
        }));
      }

      // COA-023: depth exceeded
      if (getDepth(a.id, index) > DEFAULT_MAX_DEPTH) {
        findings.push(makeFinding({
          ruleCode: 'COA-023', severity: SEVERITY.LOW, category: CAT, tenantId,
          entityType: 'Account', entityId: a.id,
          description: `Account ${code} exceeds the maximum hierarchy depth of ${DEFAULT_MAX_DEPTH}`,
          recommendation: 'Flatten the subtree',
        }));
      }
    }

    // COA-008: missing required system accounts (context: mapped purposes only —
    // a business must configure the purposes it uses; AR/AP/salaries are core)
    const corePurposes = ['ACCOUNTS_RECEIVABLE', 'ACCOUNTS_PAYABLE', 'SALARIES_AND_WAGES'];
    const tenantMappings = mappings.filter((m) => m.tenantId === tenantId);
    for (const purpose of corePurposes) {
      const viaMapping = tenantMappings.some((m) => m.purpose === purpose);
      const viaColumn = list.some((a) => a.systemPurpose === purpose && a.isActive !== false);
      if (tenantId && !viaMapping && !viaColumn) {
        findings.push(makeFinding({
          ruleCode: 'COA-008', severity: SEVERITY.MEDIUM, category: CAT, tenantId,
          entityType: 'SystemPurpose', entityId: purpose,
          confidence: CONFIDENCE.POSSIBLE,
          description: `No account is designated for core purpose ${purpose}`,
          recommendation: 'Assign the purpose via the mapping registry before Phase 4 activation',
        }));
      }
    }

    // COA-010: conflicting control accounts (multiple active CONTROL accounts for same purpose)
    const controls = new Map();
    for (const a of list) {
      if (!a.controlAccountPurpose || a.isActive === false) continue;
      if (!controls.has(a.controlAccountPurpose)) controls.set(a.controlAccountPurpose, []);
      controls.get(a.controlAccountPurpose).push(a);
    }
    for (const [purpose, rows] of controls) {
      if (rows.length > 1) {
        findings.push(makeFinding({
          ruleCode: 'COA-010', severity: SEVERITY.CRITICAL, category: CAT, tenantId,
          entityType: 'Account', entityId: rows.map((r) => r.id).join(','),
          description: `${rows.length} active control accounts for ${purpose}`,
          recommendation: 'One primary control account per business and currency context',
        }));
      }
    }
  }

  // Mapping-level checks
  for (const m of mappings) {
    const account = accountById.get(m.accountId);
    if (!account) continue;

    // COA-015: account mapped to incompatible purpose
    const constraint = SYSTEM_ACCOUNT_PURPOSES[m.purpose];
    if (constraint) {
      const check = validateAccountForPurpose(m.purpose, {
        tenantId: account.tenantId,
        category: account.coaV2Category,
        subType: account.coaV2SubType,
        behaviour: account.coaV2Behaviour,
        normalBalance: account.coaV2NormalBalance,
        status: account.coaV2Status ?? 'ACTIVE',
        isActive: account.isActive,
        hasActiveChildren: false,
      }, { businessId: m.tenantId });
      if (!check.valid) {
        findings.push(makeFinding({
          ruleCode: 'COA-015', severity: SEVERITY.HIGH, category: CAT, tenantId: m.tenantId,
          entityType: 'CoaV2AccountMapping', entityId: m.id,
          description: `Mapping ${m.purpose} → ${account.accountCode ?? account.id}: ${check.errors.join('; ')}`,
          recommendation: 'Re-point the mapping to an eligible account',
        }));
      }
    }

    // COA-025: mapping crossing business scope
    if (account.tenantId !== m.tenantId) {
      findings.push(makeFinding({
        ruleCode: 'COA-025', severity: SEVERITY.CRITICAL, category: CAT, tenantId: m.tenantId,
        entityType: 'CoaV2AccountMapping', entityId: m.id,
        description: `Mapping ${m.purpose} points to an account owned by ${account.tenantId}`,
        recommendation: 'Mappings must stay within one business',
      }));
    }

    // COA-011: deprecated account still mapped (selected by modules)
    if (account.coaV2Status === 'DEPRECATED' || account.acceptsNewTransactions === false) {
      findings.push(makeFinding({
        ruleCode: 'COA-011', severity: SEVERITY.HIGH, category: CAT, tenantId: m.tenantId,
        entityType: 'CoaV2AccountMapping', entityId: m.id,
        description: `Active mapping ${m.purpose} targets deprecated/blocked account ${account.accountCode ?? account.id}`,
        recommendation: 'Re-point the mapping to the replacement account',
      }));
    }

    // COA-017: payroll mapped outside the approved salary account
    if (m.purpose === 'SALARIES_AND_WAGES') {
      const code = account.accountCode ?? account.code;
      if (code !== '5200') {
        findings.push(makeFinding({
          ruleCode: 'COA-017', severity: SEVERITY.HIGH, category: CAT, tenantId: m.tenantId,
          entityType: 'CoaV2AccountMapping', entityId: m.id,
          confidence: CONFIDENCE.HIGHLY_LIKELY,
          description: `Salary purpose maps to ${code}, not the approved 5200 Salaries & Wages`,
          recommendation: 'Confirm with finance; 5200 is the approved canonical salary account',
        }));
      }
    }
  }

  // COA-006 / COA-016 rely on posting-time enforcement; scan recent lines into deprecated accounts
  const blockedAccounts = accounts.filter(
    (a) => a.coaV2Status === 'DEPRECATED' || a.coaV2Status === 'ARCHIVED' || a.acceptsNewTransactions === false
  );
  for (const account of blockedAccounts.slice(0, 200)) {
    const recent = await prisma.transactionLine.count({
      where: {
        accountId: account.id,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    });
    if (recent > 0 && account.coaV2Status) {
      findings.push(makeFinding({
        ruleCode: 'COA-006', severity: SEVERITY.HIGH, category: CAT, tenantId: account.tenantId,
        entityType: 'Account', entityId: account.id,
        description: `Deprecated/blocked account ${account.accountCode ?? account.id} received ${recent} posting line(s) in the last 30 days`,
        recommendation: 'Investigate which module bypasses lifecycle checks',
      }));
    }
  }

  return {
    findings,
    summary: {
      accountsScanned: accounts.length,
      mappingsScanned: mappings.length,
      aliasesScanned: aliases.length,
      tenantsScanned: byTenant.size,
    },
  };
}
