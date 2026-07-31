# ADR-011: Server-Only Credentials

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

**Status:** Accepted (conditional where noted)

## Context

settings.token plaintext blocker.

## Decision

Vaulted encrypted JWT/secretKey; never browser/outbox/logs.

## Alternatives considered

Store in TenantSettings plaintext — rejected.

## Consequences

Vault + key management ops.

## Implementation phases

6–7

## Evidence

Phase 2 SECRET_MANAGEMENT

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
