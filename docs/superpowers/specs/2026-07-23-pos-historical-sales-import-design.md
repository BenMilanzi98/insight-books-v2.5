# POS Historical Sales Import — Design

**Date:** 2026-07-23  
**Status:** Approved for implementation  
**Decisions:** Record past sales + accounting; **do not** change stock. Services from `/stock` are invoice-only (hidden from `/pos`).

## Goals

1. Simple CSV template and wizard on POS Historical tab.
2. Reliable date parsing/normalization and preview of date range.
3. Import creates historical sales with GL revenue posting; no stock/FIFO.
4. Exclude `isService` catalog items from POS product lists.

## Template columns

`date,reference,customer,description,qty,unit_price,tax_percent,payment_method,notes`

## Flow

Download → Upload → Preview (validate + date summary) → Confirm → Results.

## Integrity

- Past dates only; reject unreadable/future dates.
- Custom sale lines (no product stock link).
- `isHistorical`, `historicalDate`, `migrationBatch`, `originalReference` persisted.
- No MRA EIS submission for historical imports.
