import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('hirings workspace', () => {
  it('provides customer and supplier tabs in a shared, suspense-wrapped workspace', () => {
    const hub = read('components/rentals/HiringsHub.jsx');

    expect(hub).toContain("import { Suspense } from 'react'");
    expect(hub).toContain('PosStylePageHeader');
    expect(hub).toContain('Customer hire');
    expect(hub).toContain('Supplier hire');
    expect(hub).toContain('router.replace(`/rentals/hirings?tab=${next}`)');
    expect(hub).toContain('<RentalsClient mode="hiring" embedded />');
    expect(hub).toContain('<InboundHiringPanel embedded />');
  });

  it('allows the customer hiring client to suppress duplicate page chrome', () => {
    const rentalsClient = read('app/rentals/RentalsClient.js');

    expect(rentalsClient).toContain('export default function RentalsClient({ mode, embedded = false })');
    expect(rentalsClient).toContain('{!embedded && (');
  });

  it('allows the supplier panel to run inside the shared workspace chrome', () => {
    const supplierPanel = read('components/rentals/InboundHiringPanel.jsx');

    expect(supplierPanel).toContain('export default function InboundHiringPanel({ embedded = false })');
    expect(supplierPanel).toContain('{!embedded && (');
  });
});
