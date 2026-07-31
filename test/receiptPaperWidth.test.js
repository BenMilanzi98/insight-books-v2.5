import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RECEIPT_PAPER_WIDTH_DEFAULT_MM,
  normalizeReceiptPaperWidthMm,
  receiptViewportWidthPx,
} from '../lib/receiptPaperWidth.js';

describe('receiptPaperWidth', () => {
  it('defaults to 80 mm', () => {
    assert.equal(normalizeReceiptPaperWidthMm(undefined), RECEIPT_PAPER_WIDTH_DEFAULT_MM);
    assert.equal(normalizeReceiptPaperWidthMm(null), 80);
    assert.equal(normalizeReceiptPaperWidthMm(''), 80);
  });

  it('clamps to 58–90 mm', () => {
    assert.equal(normalizeReceiptPaperWidthMm(40), 58);
    assert.equal(normalizeReceiptPaperWidthMm(58), 58);
    assert.equal(normalizeReceiptPaperWidthMm(80), 80);
    assert.equal(normalizeReceiptPaperWidthMm(90), 90);
    assert.equal(normalizeReceiptPaperWidthMm(120), 90);
    assert.equal(normalizeReceiptPaperWidthMm('72.4'), 72);
  });

  it('computes viewport px from mm', () => {
    assert.equal(receiptViewportWidthPx(80), 302);
    assert.ok(receiptViewportWidthPx(58) < receiptViewportWidthPx(80));
    assert.ok(receiptViewportWidthPx(90) > receiptViewportWidthPx(80));
  });
});
