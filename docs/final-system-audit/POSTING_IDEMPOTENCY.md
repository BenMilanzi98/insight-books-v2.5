# Posting Idempotency

## Identity

tenant/business + sourceType + sourceId + postingPurpose + sourceVersion via AcctV2 event registry.

## DB

Unique constraints on event registry prevent duplicate successful posts for same identity.

## Gaps

- Legacy writers outside engine may bypass
- Payment callback / worker paths must all call executePosting
- Outbox redelivery safe only when handlers are idempotent (dispatcher missing)

## Result

**ENGINE: COMPLETE_REQUIRES_TESTING · ESTATE: PARTIAL**
