import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('DesktopDevice schema', () => {
  const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
  it('declares DesktopDevice and DesktopOutboxReceipt', () => {
    expect(schema).toMatch(/model DesktopDevice/);
    expect(schema).toMatch(/model DesktopOutboxReceipt/);
    expect(schema).toMatch(/desktopDevices\s+DesktopDevice\[\]/);
  });
});
