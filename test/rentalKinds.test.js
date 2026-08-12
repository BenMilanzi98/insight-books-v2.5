import { describe, expect, it } from 'vitest';
import {
  normalizeOutboundRentalKind,
  isQuantityPoolKind,
  outboundKindLabel,
} from '../lib/rentalKinds.js';

describe('rentalKinds', () => {
  it('maps quantity aliases to legacy hiring kind', () => {
    expect(normalizeOutboundRentalKind('quantity_pool')).toBe('hiring');
    expect(normalizeOutboundRentalKind('hiring')).toBe('hiring');
    expect(normalizeOutboundRentalKind('pool')).toBe('hiring');
  });

  it('maps rental aliases', () => {
    expect(normalizeOutboundRentalKind('rental')).toBe('rental');
    expect(normalizeOutboundRentalKind('space')).toBe('rental');
  });

  it('rejects inbound-sounding unknown kinds', () => {
    expect(normalizeOutboundRentalKind('supplier_hire')).toBeNull();
  });

  it('labels quantity pool for operators', () => {
    expect(outboundKindLabel('hiring')).toBe('Customer hire');
    expect(isQuantityPoolKind('hiring')).toBe(true);
  });
});
