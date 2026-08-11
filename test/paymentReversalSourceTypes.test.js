import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reversalServicePath = path.resolve(__dirname, '../lib/transactionReversalService.js');

describe('payment reversal source type coverage', () => {
  const source = readFileSync(reversalServicePath, 'utf8');

  it('includes Invoice-Revenue among V2 source types reversed for payments', () => {
    const blockMatch = source.match(
      /async function createPaymentReversal\([\s\S]*?const reversalRef = await generateReversalReference/
    );
    expect(blockMatch).not.toBeNull();

    const block = blockMatch[0];
    expect(block).toMatch(/sourceTypes:\s*\[\s*'Payment'\s*,\s*'Invoice-Revenue'\s*\]/);
    expect(block).toMatch(/sourceIds:\s*\[\s*originalPayment\.id\s*\]/);
  });
});
