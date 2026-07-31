# Security Data Flow Map

Control-plane data flows for authentication, authorization, separation of duties, approvals, domain execution, audit, and monitoring. **Current** reflects as-built code; **target** reflects Phase 15 `lib/securityGovernance/` design.

---

## Current state

```mermaid
flowchart LR
  subgraph Actor
    U[Tenant user browser]
    A[Admin user]
    C[Cron / script]
  end

  subgraph Auth
    SC[session cookie<br/>base64 JSON unsigned]
    JWT[admin_token JWT]
    CS[CRON_SECRET header]
  end

  subgraph Membership
    TM[TenantMembership lookup]
    GR[Global User.role fallback]
  end

  subgraph AuthZ
    MW[middleware.js]
    TAA[tenantApiAccess prefix map]
    AG[api-guard / page-guard]
    HP[hasPermission JSON RBAC]
    RG[Module routeGuards<br/>accountingV2, coaV2, equity, bank, close, planning, loan]
  end

  subgraph SoD
    MS[Module-local SoD checks<br/>inconsistent coverage]
  end

  subgraph Approval
    MA[Module approval tables<br/>eqV2EquityApproval, repair batch, etc.]
    WF[Legacy ApprovalWorkflowForm UI<br/>not centralized]
  end

  subgraph Domain
    SVC[Business services / Prisma]
  end

  subgraph Audit
    AL[AuditLog mutable]
    AAL[AdminAuditLog]
    LOG[Console / accountingLogger]
  end

  subgraph Monitoring
    AUD[AUTHZ_AUDIT_MODE soft allow]
    MON[TEN-001/002 audit rules]
    MOCK[Admin security UI mocks]
  end

  U --> SC
  A --> JWT
  C --> CS

  SC --> MW
  MW --> TAA --> AG --> HP
  HP --> RG
  RG --> MS
  MS --> MA
  MA --> SVC
  RG --> SVC

  SC --> TM
  TM --> GR
  GR --> HP

  SVC --> AL
  SVC --> LOG
  A --> AAL

  AG -.->|soft mode| AUD
  SVC --> MON
  AL --> MOCK
```

### Current flow notes

1. **Actor → Auth:** Tenant auth is cookie-only; no server session row. Admin is separate JWT plane.
2. **Auth → Membership:** Every `getUserFromSession` reloads user; membership overrides role.
3. **Membership → AuthZ:** Middleware enforces session + prefix permissions; V2 module prefixes **missing from map** — blocked at middleware unless public (handlers add second guard).
4. **AuthZ → SoD:** Only if module implements it; legacy routes often skip.
5. **SoD → Approval:** Per-module tables; no shared state machine.
6. **Approval → Domain:** Approved actions call domain services; some paths auto-approve.
7. **Domain → Audit:** Best-effort `AuditLog.create`; deletions possible.
8. **Audit → Monitoring:** Partial — accounting audit rules for tenancy; security monitoring mostly admin UI placeholders.

### High-risk bypass paths (current)

```mermaid
flowchart TD
  U[Authenticated user] -->|query tenantId| SEC2[SEC-2 supplier routes]
  U -->|any role| SEC3[SEC-3 reversal route]
  U -->|guess URL| UP[/uploads static public/]
  U -->|tamper cookie tenantId| SESS[Session parse then DB reload<br/>partial mitigation]
  EXT[External caller] -->|no webhook sig| WH[Future webhooks<br/>schema only today]
```

---

## Target state (Phase 15)

```mermaid
flowchart LR
  subgraph Actor
    U2[Tenant user]
    S2[Service account]
    A2[Admin]
  end

  subgraph Auth
    SS[Signed session or<br/>server session store]
    AK[Scoped API keys]
    JWT2[Admin JWT unchanged]
  end

  subgraph Membership
    AC[ActorContext<br/>userId, businessId, roles, permissions]
  end

  subgraph AuthZ
    PE[Policy engine<br/>lib/securityGovernance/application/policyEngine]
    MW2[Middleware catalogue<br/>all API prefixes]
    MC[Module capability tokens]
  end

  subgraph SoD
    SD[SoD registry<br/>creator/approver/executor matrix]
  end

  subgraph Approval
    AE[Unified approval engine<br/>state machine + escalations]
  end

  subgraph Domain
    SVC2[Module services<br/>accept ActorContext only]
  end

  subgraph Audit
    IA[Immutable audit stream<br/>append-only + hash optional]
    SE[Security event bus]
  end

  subgraph Monitoring
    RL[Rate limits]
    AL2[Alerts on deny / SoD violation]
    SIEM[Export to SIEM webhook]
  end

  U2 --> SS
  S2 --> AK
  A2 --> JWT2

  SS --> AC
  AK --> AC
  JWT2 --> A2

  AC --> PE
  PE --> MW2
  PE --> MC
  MC --> SD
  SD --> AE
  AE --> SVC2
  PE --> SVC2

  SVC2 --> IA
  PE --> SE
  SE --> AL2
  IA --> SIEM
  PE --> RL
```

### Target flow guarantees

| Step | Guarantee |
|---|---|
| Actor → Auth | All tenant identities resolve to **`ActorContext`**; client never supplies `businessId` (extends ADR-005 / P2-02) |
| Auth → Membership | Membership + branch + permission snapshot cached in signed session or server store |
| Membership → AuthZ | **Single policy evaluation** — middleware and handlers call same engine |
| AuthZ → SoD | Deny or escalate when preparer = approver for protected action classes |
| SoD → Approval | Pending approvals block domain mutation; unified inbox API |
| Approval → Domain | Domain receives `{ context, approvalId, evidence }` bundle |
| Domain → Audit | Every security-relevant decision emits immutable event |
| Audit → Monitoring | Rate limit + alert on repeated denies, cross-tenant attempts, audit tamper |

### Target remediation of known gaps

```mermaid
flowchart TD
  PE[Policy engine] -->|fix| SEC2T[SEC-2: reject query tenantId]
  PE -->|fix| SEC3T[SEC-3/4: capital + reversal permissions]
  SS -->|fix| SESS2[Signed sessions + revocation list]
  AE -->|fix| SOD[Hard SoD across modules]
  IA -->|fix| TAMPER[Detect AuditLog mutation attempts]
  MW2 -->|fix| V2PREFIX[Register accounting-v2, coa-v2, ... prefixes]
  UP2[Upload gateway] -->|fix| SIGN[Signed download URLs]
```

---

## Sequence: authenticated API request (target)

```mermaid
sequenceDiagram
  participant Client
  participant MW as Middleware
  participant Auth as Session service
  participant Pol as Policy engine
  participant SoD as SoD registry
  participant App as Domain service
  participant Aud as Audit stream

  Client->>MW: HTTPS + session cookie
  MW->>Auth: Validate / refresh session
  Auth-->>MW: ActorContext
  MW->>Pol: authorize(context, route, action)
  Pol->>SoD: check duties(context, action)
  SoD-->>Pol: allow / deny / needs_approval
  alt denied
    Pol-->>Client: 403 + correlationId
    Pol->>Aud: security.deny
  else needs approval
    Pol-->>Client: 202 + approvalId
  else allowed
    Pol->>App: invoke(context, payload)
    App->>Aud: domain.mutation
    App-->>Client: 200
  end
```

---

## Related documents

- `CURRENT_SECURITY_ARCHITECTURE.md` — component detail
- `TARGET_SECURITY_ARCHITECTURE.md` — `lib/securityGovernance/` module design
- `THREAT_MODEL.md` — threat ↔ control mapping
