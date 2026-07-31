# Hiring Domain Definition (Inbound)

The Business is the **customer / hirer**.

## Includes

Machinery, vehicles, tools, operators, subcontracted services, temporary facilities hired from **Suppliers** for branches/projects/jobs.

## Financial effects (may create)

Hire / plant / vehicle / subcontractor **expense** or project cost; prepaid hire; supplier deposit **asset**; accrued hire liability; AP; cash/bank payments.

## Must not

- Post Customer Rental Revenue  
- Capitalise hired-in gear into owned Assets/Inventory without acquisition workflow  
- Expense refundable supplier deposits  
- Post expense on Hire Request/Order  
- Re-expense on supplier payment  

## Current code mapping

Nav **Hiring** today = outbound quantity-pool rental (`kind=hiring`) to Clients — **different domain**.  
Inbound Hiring must be new aggregates (`HireRequest`, `HireAgreement`, …). Rename outbound UI to avoid operator confusion.
