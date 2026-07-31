# Rental Domain Definition (Outbound)

The Business is the **provider / lessor**.

## Includes

Vehicles, plant, tools, machinery, event equipment, rooms/facilities, reusable products, equipment+operator, time-based services rented to **Customers**.

## Financial effects (may create)

Rental / service / delivery / late-fee / damage / fuel-recovery **revenue**; AR; customer deposits (liability); deferred revenue; cash/bank receipts.

## Must not

- Confuse with supplier Hire Expense  
- Recognise refundable deposits as revenue  
- Dispose Fixed Assets on dispatch  
- Post COGS for reusable ownership units  
- Create journals from quotation/reservation alone  

## Current code mapping

`RentalAsset.kind = 'rental'` and (historically) quantity mode currently labelled hiring — both are outbound. Preserve invoice history; evolve lifecycle toward Contract + policy-based billing.
