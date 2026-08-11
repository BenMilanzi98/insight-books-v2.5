// test/invoiceDeferredRevenue.test.js
import { describe, it, expect } from 'vitest';
import {
  computePaymentRecognizedNet,
  computeFinalPaymentRecognizedNet,
} from '../lib/invoiceDeferredRevenue.js';

describe('invoice deferred revenue math', () => {
  it('pro-rates net revenue by payment / total', () => {
    // total 1180, tax 180, net 1000; pay 590 → recognize 500
    expect(
      computePaymentRecognizedNet({
        paymentAmount: 590,
        invoiceTotal: 1180,
        invoiceTaxAmount: 180,
      })
    ).toBe(500);
  });

  it('final payment uses remaining net not a fresh multiply', () => {
    expect(
      computeFinalPaymentRecognizedNet({
        invoiceNet: 1000,
        previouslyRecognizedNet: 500,
      })
    ).toBe(500);
  });
});
