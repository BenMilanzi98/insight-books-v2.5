# Multi-Currency Reporting

## Rules implemented

- Formal financial statements default to the **business base currency**
  (context `baseCurrency`, default MWK); the envelope's `currency` field
  records the presentation currency.
- Canonical journal lines carry `currency`, `baseDebitMinor` and
  `baseCreditMinor`. Legacy lines have no currency column and are treated as
  base-currency lines — explicitly, in `canonicalJournalSource.js`.
- `listCanonicalLines` supports a currency filter for currency-specific
  ledger detail (foreign-currency account drill-down).
- Historical amounts are **never** retranslated at current rates: reports use
  the base amounts recorded at posting. Presentation-currency translation and
  revaluation reports are a separately approved future workflow; the request
  contract already reserves `presentationCurrency` for it.
- REP-029 (currency scope inconsistent) is part of the validation catalogue;
  since every statement reads base amounts from one source, mixed-currency
  totals cannot occur inside the engine.

## Deferred

Exchange-rate source/date display, revaluation journals and
presentation-currency statements await the multi-currency posting rollout in
the operational modules. The reporting contract is ready: rates and
translation metadata will attach to the envelope without changing any report
consumer.
