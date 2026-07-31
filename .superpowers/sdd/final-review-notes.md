# Final Phase 8 Review Package Notes
Working tree (commits deferred). Surfaces:
- lib/admin/health/**
- lib/admin/customerSuccess/**
- app/api/admin/intelligence/customer-health/**
- app/api/admin/customer-success/**
- app/insightbooks/intelligence/customer-health/**
- app/insightbooks/customer-success/**
- docs/admin-intelligence-crm/phase-08/**
- test/systemAdmin.customerHealth.test.js
- test/systemAdmin.customerSuccess.test.js
- scripts/sql/customer-health-phase08.sql
- scripts/sql/customer-success-phase08.sql

Minor findings carried from task reviews (triage):
- T1: prisma/permissions dirty tree may bundle Phase 7 when committing — stage carefully
- T3: renewals UI manageRenewals gate; CHURNED evidence breadth; PENDING→CLOSED workspace
- T2 residual: foundation stub direct URL auth polish
