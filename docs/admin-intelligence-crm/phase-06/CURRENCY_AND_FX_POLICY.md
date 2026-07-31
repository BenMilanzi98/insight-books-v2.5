# Currency and FX Policy

1. Every money metric is bucketed by **native currency** (`AccountSubscription.currency`, payment/invoice currency).
2. UI/API default: primary operating currency (typically MWK) plus explicit currency filter.
3. **Cross-currency totals** are **UNAVAILABLE** until:
   - A documented FX rate source exists (admin config or system table), and
   - Rate date/policy is shown on the metric envelope, and
   - Conversion is server-side and audited.
4. Never silently convert or drop foreign-currency rows without a limitations banner listing excluded currencies/counts.
