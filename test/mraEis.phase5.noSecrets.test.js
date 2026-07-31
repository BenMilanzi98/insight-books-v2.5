import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase 5 schema secret hygiene', () => {
  it('does not define plaintext credential columns on Phase 5 models', () => {
    const schema = fs.readFileSync(path.resolve('prisma/schema.prisma'), 'utf8');
    const phase5Start = schema.indexOf('model MraEisTerminal');
    expect(phase5Start).toBeGreaterThan(-1);
    const phase5 = schema.slice(phase5Start);

    // Forbidden plaintext fields on new operational models
    expect(phase5).not.toMatch(/\bjwt\b\s+String/i);
    expect(phase5).not.toMatch(/\bsecretKey\b\s+String/i);
    expect(phase5).not.toMatch(/\bterminalSecret\b\s+String/i);
    expect(phase5).not.toMatch(/\bactivationCode\b\s+String/i);
    expect(phase5).not.toMatch(/\bbuyerAuthorizationCode\b\s+String/i);
    expect(phase5).toContain('vaultReference');
    expect(phase5).toContain('model MraEisOutbox');
    expect(phase5).toContain('model MraEisSnapshot');
  });

  it('migration SQL includes unique fiscal sequence and snapshot constraints', () => {
    const sql = fs.readFileSync(
      path.resolve('prisma/migrations/20260722230000_mra_eis_phase5_foundation/migration.sql'),
      'utf8'
    );
    expect(sql).toContain('MraEisFiscalSequence_unique');
    expect(sql).toContain('MraEisSnapshot_source_unique');
    expect(sql).toContain('MraEisTransmission_snapshot_mode_unique');
    expect(sql).toContain('MraEisCredentialReference_one_active');
    expect(sql).toContain('MraEisConfigurationSnapshot_one_active');
    expect(sql).not.toMatch(/jwt TEXT/i);
  });
});
