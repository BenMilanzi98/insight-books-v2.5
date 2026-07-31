# Customer 360 Response Contract

Conceptual shape returned by `buildCustomer360` / `GET .../customers/[tenantId]`:

```json
{
  "customer": {
    "tenantId": "",
    "customerReference": "",
    "displayName": "",
    "lifecycleStage": "",
    "customerSince": null,
    "status": ""
  },
  "hierarchy": {
    "branchCount": null,
    "userCount": null,
    "activeUserCount": null
  },
  "commercial": {
    "plan": null,
    "subscriptionStatus": null,
    "currency": null,
    "mrr": null,
    "arr": null,
    "billed": null,
    "collected": null,
    "outstanding": null,
    "renewalDate": null,
    "_envelope": "metric envelopes or section status"
  },
  "engagement": {
    "lastLoginAt": null,
    "lastMeaningfulActivityAt": null,
    "activeUsersProxy": null,
    "limitations": "Login-based proxy; not unique-user DAU"
  },
  "adoption": { "status": "UNAVAILABLE", "reason": "FEATURE_USED not emitted" },
  "mraEis": {
    "entitlementStatus": null,
    "commercialPlan": null,
    "operationalReadiness": null
  },
  "service": {
    "support": { "status": "NOT_INSTRUMENTED" },
    "onboarding": { "status": "NOT_INSTRUMENTED" },
    "training": { "status": "NOT_INSTRUMENTED" }
  },
  "signals": { "risk": [], "opportunity": [], "attention": [] },
  "ownership": { "portfolioId": null, "primaryOwnerId": null },
  "reliability": {
    "freshness": null,
    "reconciliation": null,
    "dataQuality": null,
    "limitations": []
  },
  "meta": {
    "ruleVersions": {},
    "generatedAt": "",
    "catalogueVersion": ""
  }
}
```

Rules: omit restricted fields server-side; never send fake zeroes for failed sections; mark UNAVAILABLE explicitly.
