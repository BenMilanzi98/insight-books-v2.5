# Rental Pricing Audit

## Current

- `defaultRate` (Float) + `rateUnit` (`day`|`hour`) on `RentalAsset`  
- `computeBillableUnits` = duration ms / day or hour  
- Optional `unitPrice` override on booking line  
- Invoice line qty = billableUnits × (hiring qty)  
- Tax via invoice line taxRate  
- No versioned Rate Plans, weekends, holidays, minimums, deposits, delivery, OT, usage overage  

**Disposition:** `INCOMPLETE` + Float → `INCORRECT_CALCULATION` risk; `REIMPLEMENT` pricing engine with Decimal + explanations.

## Gaps

Versioned plans, customer categories, grace periods, tiered/long-term, delivery/collection/setup/operator, damage waiver, late rules, currency FX, reproducible explanation, override approval — all missing.
