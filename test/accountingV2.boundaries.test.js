/**
 * Architecture boundary tests — enforce dependency direction with static analysis.
 * These rules protect the V2 kernel from erosion during the transition.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

const ROOT = join(process.cwd());
const V2_ROOT = join(ROOT, 'lib', 'accountingV2');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (['node_modules', '.next', '.git', 'artifacts'].includes(entry)) continue;
      walk(full, out);
    } else if (/\.(js|jsx|mjs|cjs)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const rel = (file) => relative(ROOT, file).split(sep).join('/');
const read = (file) => readFileSync(file, 'utf8');

const v2Files = walk(V2_ROOT).map((f) => ({ path: rel(f), source: read(f) }));
const appFiles = walk(join(ROOT, 'app')).map((f) => ({ path: rel(f), source: read(f) }));
const componentFiles = (() => {
  try {
    return walk(join(ROOT, 'components')).map((f) => ({ path: rel(f), source: read(f) }));
  } catch {
    return [];
  }
})();

describe('accounting V2 dependency boundaries', () => {
  it('V2 domain layer has no framework, database, or legacy dependencies', () => {
    const domainFiles = v2Files.filter((f) => f.path.includes('accountingV2/domain/'));
    expect(domainFiles.length).toBeGreaterThan(0);
    for (const file of domainFiles) {
      expect(file.source, file.path).not.toMatch(/@prisma\/client/);
      expect(file.source, file.path).not.toMatch(/from ['"]next/);
      expect(file.source, file.path).not.toMatch(/\.\.\/(\.\.\/)+(accountingEngine|journalService|purchaseAccounting)/);
      expect(file.source, file.path).not.toMatch(/from ['"].*\/prisma\.js['"]/);
    }
  });

  it('only the legacy adapters import legacy accounting internals', () => {
    const nonAdapterFiles = v2Files.filter((f) => !f.path.includes('infrastructure/legacy/'));
    for (const file of nonAdapterFiles) {
      expect(file.source, file.path).not.toMatch(/accountingEngine\/postGlEntry/);
      expect(file.source, file.path).not.toMatch(/from ['"].*journalService\.js['"]/);
      expect(file.source, file.path).not.toMatch(/from ['"].*purchaseAccounting\.js['"]/);
      expect(file.source, file.path).not.toMatch(/from ['"].*accountBalanceService\.js['"]/);
    }
  });

  it('V2 code never writes legacy financial tables outside the approved journal writers', () => {
    // Phase 4: the ONLY V2 modules allowed to write the shared JournalEntry
    // tables are the engine's journal persistence and the manual-journal
    // service (pre-posted draft rows). Everything else stays read-only.
    const APPROVED_JOURNAL_WRITERS = [
      'lib/accountingV2/engine/journalPersistence.js',
      'lib/accountingV2/application/manualJournalService.js',
      // Phase 8: legacy period migration assigns canonical period references
      // (accountingPeriodId / financialYearLabel) to posted journals. It never
      // touches amounts, dates, accounts, or status — enforced below.
      'lib/accountingV2/periods/legacyPeriodMigrationService.js',
    ];
    for (const file of v2Files) {
      // Legacy Transaction ledger + account balances: never written by V2 code
      // (legacy writes are limited to the posting adapter's delegation to postGlEntry).
      expect(file.source, file.path).not.toMatch(/\.(transaction|transactionLine|account|accountBalance)\.(update|updateMany|delete|deleteMany|create|createMany)\(/);
      if (!APPROVED_JOURNAL_WRITERS.includes(file.path)) {
        expect(file.source, file.path).not.toMatch(/\.(journalEntry|journalEntryLine)\.(update|updateMany|delete|deleteMany|create|createMany)\(/);
      }
      // Even approved writers never hard-delete journals.
      expect(file.source, file.path).not.toMatch(/\.(journalEntry)\.(delete|deleteMany)\(/);
    }

    // The migration writer may only assign period references — never amounts,
    // dates or status, and never create/delete journal rows.
    const migration = v2Files.find((f) => f.path === 'lib/accountingV2/periods/legacyPeriodMigrationService.js');
    if (migration) {
      expect(migration.source).not.toMatch(/journalEntry\.(create|createMany|updateMany)\(/);
      const updates = migration.source.match(/journalEntry\.update\([\s\S]*?\n\s*\}\);/g) ?? [];
      expect(updates.length).toBeGreaterThan(0);
      for (const update of updates) {
        expect(update).toMatch(/accountingPeriodId/);
        expect(update).not.toMatch(/totalDebit|totalCredit|entryDate|postingDate|status:/);
      }
    }
  });

  it('UI components do not import accounting persistence or the V2 kernel infrastructure', () => {
    for (const file of componentFiles) {
      expect(file.source, file.path).not.toMatch(/accountingV2\/infrastructure/);
      expect(file.source, file.path).not.toMatch(/from ['"]@\/lib\/prisma['"]/);
    }
  });

  it('client pages never import Prisma or V2 infrastructure directly', () => {
    const clientPages = appFiles.filter((f) => f.source.includes("'use client'") || f.source.includes('"use client"'));
    for (const file of clientPages) {
      expect(file.source, file.path).not.toMatch(/from ['"]@\/lib\/prisma['"]/);
      expect(file.source, file.path).not.toMatch(/accountingV2\/infrastructure/);
    }
  });

  it('no production module outside the V2 kernel queries shadow tables', () => {
    const outside = [...appFiles, ...componentFiles].filter(
      (f) => !f.path.startsWith('app/api/system/accounting-architecture')
    );
    for (const file of outside) {
      expect(file.source, file.path).not.toMatch(/acctV2ShadowJournal(Line)?\.(findMany|findFirst|findUnique|aggregate|groupBy|count)/);
    }
    // and legacy report services must not touch shadow tables at all
    // (the read-only forensic audit engine is exempt — it inspects everything)
    const legacyReportFiles = walk(join(ROOT, 'lib')).filter(
      (f) => !rel(f).includes('accountingV2') && !rel(f).includes('accountingAudit')
    );
    for (const file of legacyReportFiles) {
      const source = read(file);
      expect(source, rel(file)).not.toMatch(/acctV2ShadowJournal/i);
    }
  });

  it('new API routes validate money as decimal strings (no float acceptance in V2 schemas)', () => {
    const schemas = read(join(V2_ROOT, 'contracts', 'apiSchemas.js'));
    expect(schemas).toMatch(/decimalString/);
    expect(schemas).not.toMatch(/z\.number\(\)\.(min|max)?.*amount/i);
  });

  it('V2 enums are defined exactly once', () => {
    const enumDefs = v2Files.filter((f) => /export const PostingMode\s*=/.test(f.source));
    expect(enumDefs.map((f) => f.path)).toEqual(['lib/accountingV2/domain/enums.js']);
  });
});

describe('service contracts are satisfied', () => {
  it('every registered implementation provides its contract methods', async () => {
    const contracts = await import('../lib/accountingV2/contracts/serviceContracts.js');
    // assertImplements already ran at module load; spot-check the registry:
    expect(typeof contracts.accountingPostingService.post).toBe('function');
    expect(typeof contracts.accountMappingService.resolveMappedAccount).toBe('function');
    expect(typeof contracts.periodResolutionService.resolvePeriod).toBe('function');
    expect(typeof contracts.generalLedgerQueryService.getLedgerTotals).toBe('function');
    expect(typeof contracts.trialBalanceQueryService.getTrialBalance).toBe('function');
    expect(typeof contracts.reversalService.getReversalState).toBe('function');
    expect(typeof contracts.journalRepository.findEventByIdempotencyKey).toBe('function');
  });

  it('journal repository exposes no mutation of posted journals', async () => {
    const contracts = await import('../lib/accountingV2/contracts/serviceContracts.js');
    expect(contracts.journalRepository.update).toBeUndefined();
    expect(contracts.journalRepository.delete).toBeUndefined();
    expect(contracts.CONTRACTS.JournalRepository).not.toContain('update');
    expect(contracts.CONTRACTS.JournalRepository).not.toContain('delete');
  });
});
