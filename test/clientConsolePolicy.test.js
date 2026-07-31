import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('clientConsolePolicy', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_CLIENT_CONSOLE_LOGS;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('defaults to enabled outside production', async () => {
    process.env.NODE_ENV = 'development';
    const { isClientConsoleEnabled } = await import('../lib/clientConsolePolicy.js');
    expect(isClientConsoleEnabled()).toBe(true);
  });

  it('defaults to disabled in production', async () => {
    process.env.NODE_ENV = 'production';
    const { isClientConsoleEnabled } = await import('../lib/clientConsolePolicy.js');
    expect(isClientConsoleEnabled()).toBe(false);
  });

  it('honours NEXT_PUBLIC_CLIENT_CONSOLE_LOGS override', async () => {
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_CLIENT_CONSOLE_LOGS = 'true';
    const { isClientConsoleEnabled } = await import('../lib/clientConsolePolicy.js');
    expect(isClientConsoleEnabled()).toBe(true);

    vi.resetModules();
    process.env.NODE_ENV = 'development';
    process.env.NEXT_PUBLIC_CLIENT_CONSOLE_LOGS = 'false';
    const mod2 = await import('../lib/clientConsolePolicy.js');
    expect(mod2.isClientConsoleEnabled()).toBe(false);
  });
});
