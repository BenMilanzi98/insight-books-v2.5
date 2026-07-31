# Purchases Accounting Posting Matrix (Target)

Canonical target after reimplementation. All posts via Accounting V2 Posting Engine only.

## PURCHASE ORDER

| | |
|--|--|
| Trigger | create / approve / issue / amend |
| Journal | **None** |
| Stock | **None** |
| Idempotency | External action keys only (no GL) |
| Reports | Ordered Commitments |

## INVENTORY GOODS RECEIPT (accepted qty)

| | |
|--|--|
| Trigger | Receipt status → Posted + inspection accepted |
| Debit | Inventory Asset |
| Credit | **GRNI / Accrued Purchases** |
| Tax | Normally none (VAT on bill) |
| Stock | `PURCHASE_RECEIPT` once per line version |
| Idempotency | `tenant + GR id + version + PURCHASE_RECEIPT_ACCOUNTING` |
| Reversal | Linked reverse JE + opposite stock |

## SERVICE RECEIPT

| | |
|--|--|
| Stock | **None** |
| GL | Confirm-only **or** service accrual policy (explicit); default defer to bill |

## INVENTORY SUPPLIER BILL (matched to receipt)

| | |
|--|--|
| Debit | GRNI (received cost) |
| Debit | Input VAT (recoverable) |
| Debit/Credit | Purchase Price Variance or approved valuation adj. |
| Debit | Freight/landed/expense as applicable |
| Credit | Accounts Payable (gross) |
| Stock | **None** |
| Forbidden | Second Inventory Asset debit for same received value (unless explicit valuation policy) |

## SERVICE / EXPENSE BILL

Dr Expense or Prepayment · Dr Input VAT · Cr AP

## CAPITAL ASSET BILL

Dr Fixed Asset or Asset Clearing · Dr Input VAT · Cr AP  
(Coordinate with asset-from-GR drafts — capitalise once.)

## SUPPLIER PAYMENT

Dr AP · Cr Cash/Bank (/ + Cr WHT Payable)  
No inventory / expense repurchase.

## SUPPLIER RETURN BEFORE BILL

Dr GRNI · Cr Inventory · opposite stock movement

## SUPPLIER RETURN AFTER BILL

Dr AP or Supplier Credit clearing · Cr Inventory · credit note links return without second stock hit

## SUPPLIER CREDIT NOTE

Dr AP · Cr expense/inventory adj/tax per source · no stock if return already posted

## Current vs target

| Event | Current | Target |
|-------|---------|--------|
| GR | Dr Inv / Cr **AP** | Dr Inv / Cr **GRNI** |
| Bill (inv) | Dr Inv/Exp / Cr AP | Dr **GRNI** (+VAT/PPV) / Cr AP |
| Payment | Dr AP / Cr Bank | Same |

## Test references

Scenarios 1–4, 6, 8, 10 in master prompt §64.
