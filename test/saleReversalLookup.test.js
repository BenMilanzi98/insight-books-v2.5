import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reversalServicePath = path.resolve(__dirname, '../lib/transactionReversalService.js');

/**
 * Sale GL reversal lookup lives in reverseSaleGlForRefundInTx. Branches are asserted via
 * static analysis so we do not need a DB or full reversal orchestration mocks.
 */
describe('sale reversal GL lookup branches (reverseSaleGlForRefundInTx)', () => {
  const source = readFileSync(reversalServicePath, 'utf8');

  it('builds saleGlLookupBranches with saleId-revenue, Sale revenue, and Sale-COGS keys', () => {
    expect(source).toContain('const saleGlLookupBranches = []');
    expect(source).toMatch(/sourceId:\s*`\$\{saleIdStr\}-revenue`/);
    expect(source).toMatch(/sourceType:\s*'Sale-COGS'/);
    expect(source).toMatch(/where:\s*\{\s*OR:\s*saleGlLookupBranches\s*\}/);
  });

  it('queries revenue branch before legacy Sale sourceId and Sale-COGS branches', () => {
    const blockMatch = source.match(
      /if \(saleIdStr\) \{[\s\S]*?saleGlLookupBranches\.push\(\{[\s\S]*?sourceType: 'Sale-COGS'[\s\S]*?\}\);\s*\}/
    );
    expect(blockMatch).not.toBeNull();

    const block = blockMatch[0];
    const revenueIdx = block.indexOf('`${saleIdStr}-revenue`');
    const plainSaleMatch = block.match(/sourceType: 'Sale',\s+sourceId: saleIdStr/);
    const cogsIdx = block.indexOf("sourceType: 'Sale-COGS'");

    expect(revenueIdx).toBeGreaterThan(-1);
    expect(plainSaleMatch).not.toBeNull();
    expect(cogsIdx).toBeGreaterThan(-1);
    expect(revenueIdx).toBeLessThan(plainSaleMatch.index);
    expect(plainSaleMatch.index).toBeLessThan(cogsIdx);
  });

  it('includes legacy description fallback for Sale-COGS and Sale revenue when sourceId miss', () => {
    expect(source).toContain('Sale ${saleNumberTrim} - COGS Recognition');
    expect(source).toContain('Sale ${saleNumberTrim} - Revenue Recognition');
  });
});
