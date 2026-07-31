# Current Admin Dashboard Audit

**Page:** `app/insightbooks/dashboard/page.js`  
**APIs:** dashboard/stats, tenant-growth, platform-billing overview/payments, system-health, users/stats, affiliate/stats  

**Issues for Phase 5:** client-side `bucketPayments`; multi-API fan-out; theatrical health/security objects in stats; stub subpages under dashboard/*.

**Reuse:** AdminSummaryCard, chart components, adminApi, i18n, projectDashboardStats patterns.
