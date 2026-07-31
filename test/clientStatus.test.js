import { describe, expect, it } from 'vitest';
import { parseClientIsActive, clientStatusLabel, withClientStatus } from '../lib/clientStatus.js';

describe('clientStatus', () => {
  it('parses Active/Inactive from form values', () => {
    expect(parseClientIsActive('Active')).toBe(true);
    expect(parseClientIsActive('Inactive')).toBe(false);
    expect(parseClientIsActive(true)).toBe(true);
    expect(parseClientIsActive(false)).toBe(false);
    expect(parseClientIsActive(undefined, true)).toBe(true);
  });

  it('labels from isActive', () => {
    expect(clientStatusLabel(true)).toBe('Active');
    expect(clientStatusLabel(false)).toBe('Inactive');
  });

  it('does not invent Inactive when isActive is true', () => {
    const client = withClientStatus({ id: '1', name: 'Acme', isActive: true });
    expect(client.status).toBe('Active');
  });
});
