# Entitlement Data Migration Report

**Generated:** 2026-07-22T20:15:09.044Z
**Mode:** DRY_RUN

## Summary

- NO_EXISTING_EIS_DATA: 5

## Rules applied

- Ordinary tenants → NOT_ENTITLED (no auto grant)
- Ambiguous enabled flags / existing EIS invoices → REQUIRES_MANUAL_REVIEW
- No production entitlement inferred from Boolean alone
- No MRA calls, no terminal activation, no Sale/Journal changes

## Rows

| Tenant | Classification | eisEnabled | EIS sub | Config | Invoices |
|---|---|---|---|---|---|
| QA-Accounting | NO_EXISTING_EIS_DATA | false | false | false | false |
| Tech Transformation | NO_EXISTING_EIS_DATA | false | false | false | false |
| Test Biz | NO_EXISTING_EIS_DATA | false | false | false | false |
| Debug Signup Co | NO_EXISTING_EIS_DATA | false | false | false | false |
| Insight Books | NO_EXISTING_EIS_DATA | false | false | false | false |
