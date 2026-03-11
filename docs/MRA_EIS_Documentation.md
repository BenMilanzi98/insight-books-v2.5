# MRA EIS Integration Documentation

## Table of Contents

1. [Introduction](#1-introduction)
2. [How It Works](#2-how-it-works)
3. [Architecture Overview](#3-architecture-overview)
4. [Database Schema](#4-database-schema)
5. [Setup & Configuration](#5-setup--configuration)
6. [User Guide](#6-user-guide)
7. [Automatic Invoice Submission](#7-automatic-invoice-submission)
8. [API Reference](#8-api-reference)
9. [Security](#9-security)
10. [Subscription & Quotas](#10-subscription--quotas)
11. [Cron Jobs & Background Sync](#11-cron-jobs--background-sync)
12. [Monitoring & Health Checks](#12-monitoring--health-checks)
13. [Troubleshooting](#13-troubleshooting)
14. [File Reference](#14-file-reference)

---

## 1. Introduction

The MRA EIS (Malawi Revenue Authority Electronic Invoice System) integration enables InsightBooks tenants to submit electronic invoices directly to MRA for tax compliance. It is a premium feature available exclusively to tenants on an EIS subscription plan.

**What it does:**

- Automatically submits sales, invoices, and converted quotations to MRA as electronic invoices
- Tracks the submission status of every invoice (Pending, Submitted, Approved, Rejected, Error)
- Provides a dedicated dashboard showing submission statistics, success rates, and monthly usage
- Manages MRA API credentials securely with AES-256 encryption
- Enforces monthly submission quotas based on the tenant's subscription plan
- Syncs invoice statuses with MRA in the background via a cron job

**Who can use it:**

Only tenants with an active EIS subscription plan (`eis-monthly` or `eis-yearly`) can access the EIS features. The system checks the subscription status before allowing configuration or invoice submission.

---

## 2. How It Works

### End-to-End Flow

```
1. Tenant configures TPIN in /account
2. Tenant enters MRA API credentials in /eis/config
3. Tenant makes a sale, creates an invoice, or converts a quotation
4. System automatically:
   a. Checks if tenant has eisEnabled = true and an active EIS subscription
   b. Transforms the transaction into MRA's required invoice format
   c. Authenticates with MRA using OAuth2 client_credentials flow
   d. Submits the invoice to MRA's /invoices/submit endpoint
   e. Saves the EIS invoice record locally with the MRA response
   f. Logs the full request/response in the submission log
   g. Updates monthly usage counters
5. If submission fails, error is recorded but the original transaction is preserved
6. Background cron job periodically syncs statuses for Pending/Submitted invoices
```

### Key Design Principles

- **Fire-and-forget:** EIS submission never blocks or fails the original transaction. If MRA is down or credentials are wrong, the sale/invoice is still saved. The EIS error is logged separately.
- **Per-tenant isolation:** Each tenant has their own MRA credentials, TPIN, and usage counters. One tenant's configuration does not affect another.
- **Encrypted credentials:** Client secrets and API keys are encrypted at rest using AES-256-CBC before being stored in the database.
- **Audit trail:** Every submission attempt (success or failure) is recorded in `EISSubmissionLog` with the full request payload, response, duration, and error details.

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend Pages                           │
│                                                                 │
│  /account        /eis             /eis/config    /eis/invoices  │
│  (TPIN field)    (Dashboard)      (Credentials)  (Invoice list) │
└──────┬────────────┬────────────────┬──────────────┬─────────────┘
       │            │                │              │
       ▼            ▼                ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API Routes                               │
│                                                                 │
│  /api/tenant/settings   /api/eis/dashboard   /api/eis/config    │
│  /api/eis/invoices      /api/eis/invoices/submit                │
│  /api/eis/invoices/[id]/status   /api/eis/health                │
│  /api/cron/eis-sync                                             │
└──────┬────────────┬────────────────┬──────────────┬─────────────┘
       │            │                │              │
       ▼            ▼                ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Core Libraries                             │
│                                                                 │
│  lib/eisService.js      lib/eisConfig.js      lib/encryption.js │
│  lib/subscriptionService.js     lib/subscriptionConfig.js       │
└──────┬────────────┬────────────────┬────────────────────────────┘
       │            │                │
       ▼            ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐
│  PostgreSQL  │  │  MRA EIS API │  │  Transaction Hooks       │
│  (Prisma)    │  │  (External)  │  │  /api/sales              │
│              │  │              │  │  /api/invoices            │
│  EISInvoice  │  │  /auth/token │  │  /api/quotations/convert │
│  EISConfig   │  │  /invoices/* │  │                          │
│  EISLog      │  │  /system/*   │  │  (auto-submit on POST)   │
│  EISUsage    │  │              │  │                          │
└──────────────┘  └──────────────┘  └──────────────────────────┘
```

### File Structure

```
lib/
├── encryption.js           # AES-256-CBC encrypt/decrypt
├── eisConfig.js            # MRA endpoints, validation rules
├── eisService.js           # Core EIS service (auth, transform, submit, sync)
├── subscriptionConfig.js   # EIS plan definitions and quotas
└── subscriptionService.js  # Subscription checks, quota enforcement

app/api/eis/
├── config/route.js                 # GET/POST - MRA credential management
├── dashboard/route.js              # GET - Dashboard statistics
├── health/route.js                 # GET - MRA connectivity check
└── invoices/
    ├── route.js                    # GET - Paginated invoice list
    ├── submit/route.js             # POST - Manual invoice submission
    └── [id]/status/route.js        # GET - Single invoice status check

app/api/cron/
└── eis-sync/route.js               # POST - Background status sync

app/eis/
├── page.js                         # EIS Dashboard page
├── config/page.js                  # EIS Configuration page
└── invoices/page.js                # EIS Invoices list page

prisma/
├── schema.prisma                   # EISInvoice, EISConfiguration,
│                                   # EISSubmissionLog, EISUsage models
└── migrations/
    └── 20260304120000_add_eis_tables/migration.sql
```

---

## 4. Database Schema

### Modified Tables

**Tenant** (existing table, new fields):

| Field | Type | Description |
|-------|------|-------------|
| `tpin` | `String?` | 8-digit Taxpayer Identification Number from MRA |
| `eisEnabled` | `Boolean` (default `false`) | Master switch for EIS auto-submission |

**TenantSettings** (existing table, new fields):

| Field | Type | Description |
|-------|------|-------------|
| `eisApiKey` | `String?` | Encrypted MRA EIS API key (legacy, prefer EISConfiguration) |
| `eisClientSecret` | `String?` | Encrypted MRA EIS client secret (legacy, prefer EISConfiguration) |

### New Tables

**EISInvoice** - Stores every invoice submitted (or attempted) to MRA:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String` (cuid) | Primary key |
| `tenantId` | `String` | Owning tenant |
| `subscriptionId` | `String?` | Linked EIS subscription |
| `invoiceNumber` | `String` | Local invoice/sale number |
| `mraInvoiceId` | `String?` | MRA-assigned invoice ID (received after approval) |
| `invoiceDate` | `DateTime` | Invoice date |
| `totalAmount` | `Float` | Total amount including tax |
| `taxAmount` | `Float` | Total tax amount |
| `status` | `String` | `Pending`, `Submitted`, `Approved`, `Rejected`, or `Error` |
| `submissionId` | `String?` | MRA submission tracking ID |
| `submittedAt` | `DateTime?` | When the submission was sent |
| `responseData` | `Json?` | Full MRA response payload |
| `errorMessage` | `String?` | Error description if failed |
| `retryCount` | `Int` (default 0) | Number of retry attempts |
| `lastRetryAt` | `DateTime?` | Last retry timestamp |
| `sourceType` | `String?` | `sale`, `invoice`, or `quotation-convert` |
| `sourceId` | `String?` | ID of the originating Sale or Invoice record |

**EISConfiguration** - Stores MRA API credentials per tenant:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String` (cuid) | Primary key |
| `tenantId` | `String` (unique) | One config per tenant |
| `clientId` | `String` | MRA OAuth2 Client ID |
| `clientSecret` | `String` | Encrypted MRA Client Secret |
| `apiKey` | `String?` | Encrypted MRA API Key (optional) |
| `environment` | `String` | `sandbox` or `production` |
| `isActive` | `Boolean` (default true) | Whether integration is enabled |
| `lastSyncAt` | `DateTime?` | Last successful sync timestamp |
| `syncStatus` | `String?` | Latest sync status |
| `settings` | `Json?` | Additional configuration options |

**EISSubmissionLog** - Audit trail for every submission attempt:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String` (cuid) | Primary key |
| `tenantId` | `String` | Owning tenant |
| `invoiceId` | `String` | Invoice number or ID |
| `requestPayload` | `Json` | Full request body sent to MRA |
| `responsePayload` | `Json?` | Full MRA response body |
| `status` | `String` | `success` or `error` |
| `errorCode` | `String?` | HTTP status code or error code |
| `errorMessage` | `String?` | Error description |
| `durationMs` | `Int` | Request duration in milliseconds |
| `createdAt` | `DateTime` | Timestamp |

**EISUsage** - Monthly usage counters per tenant:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String` (cuid) | Primary key |
| `tenantId` | `String` | Owning tenant |
| `monthYear` | `String` | Format: `YYYY-MM` (e.g., `2026-03`) |
| `invoiceCount` | `Int` (default 0) | Number of invoices submitted this month |
| `submissionCount` | `Int` (default 0) | Total submission attempts |
| `approvedCount` | `Int` (default 0) | MRA-approved count |
| `rejectedCount` | `Int` (default 0) | MRA-rejected count |
| `totalAmount` | `Float` (default 0) | Sum of all submitted invoice amounts |

Unique constraint: `(tenantId, monthYear)` -- one usage record per tenant per month.

---

## 5. Setup & Configuration

### Step 1: Environment Variables

Add these to your `.env` file (or hosting platform environment settings):

```env
# Required: 32-byte encryption key for securing MRA credentials
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your_64_hex_character_key_here

# EIS environment: "sandbox" for testing, "production" for live
EIS_ENVIRONMENT=sandbox

# Optional: Override the MRA API base URL
# Defaults to https://dev-eis-api.mra.mw (sandbox) or https://eis-api.mra.mw (production)
# EIS_API_BASE_URL=https://dev-eis-api.mra.mw

# Optional: Secret key to protect the cron sync endpoint
CRON_SECRET=a_random_secret_string
```

**Generating the encryption key:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

This outputs a 64-character hex string. Copy it into `ENCRYPTION_KEY`.

### Step 2: Database Migration

Run the Prisma migration to create the EIS tables:

```bash
npx prisma migrate deploy
npx prisma generate
```

### Step 3: Set Your TPIN

1. Navigate to `/account` in the web application
2. In the **Business Information** section, find the **Taxpayer Identification Number (TPIN)** field
3. Enter your 8-digit TPIN as assigned by the Malawi Revenue Authority
4. Click **Save Settings**

The TPIN is stored on the Tenant record and is included as the seller's TPIN in every invoice submitted to MRA.

### Step 4: Configure MRA Credentials

1. Navigate to `/eis/config` in the web application
2. Enter the credentials provided by MRA:
   - **Client ID** -- Your MRA OAuth2 client identifier
   - **Client Secret** -- Your MRA OAuth2 client secret (encrypted before storage)
   - **API Key** (optional) -- If MRA provided an additional API key
3. Select the **Environment**:
   - **Sandbox (Testing)** -- For development and testing against MRA's sandbox
   - **Production (Live)** -- For real invoice submissions
4. Ensure the **Enable EIS Integration** checkbox is checked
5. Click **Save Configuration**
6. Click **Test Connection** to verify connectivity to MRA

Once saved, the tenant's `eisEnabled` flag is set to `true` and all future sales/invoices will be automatically submitted to MRA.

### Step 5: Verify

1. Navigate to `/eis` (EIS Dashboard)
2. Confirm the **MRA Connected** indicator shows green
3. The dashboard should show "EIS Configuration Active"
4. Make a test sale or create a test invoice
5. Return to `/eis` and check that the invoice appears in **Recent Submissions**

---

## 6. User Guide

### EIS Dashboard (`/eis`)

The main dashboard provides an at-a-glance view of your MRA EIS activity:

- **Connection status** -- Green "MRA Connected" badge (or red "MRA Disconnected") with latency
- **Configuration alert** -- Warning banner if MRA credentials haven't been configured yet
- **Statistics cards:**
  - Total Submitted -- Total invoices sent to MRA
  - Approved -- Invoices accepted by MRA
  - Pending -- Invoices awaiting MRA processing
  - Rejected -- Invoices rejected by MRA
  - Success Rate -- Percentage of approved invoices
- **Current Month Usage** -- This month's invoice count, approved, rejected, and total amount
- **Recent Submissions** -- Table showing the last 10 submitted invoices

### EIS Configuration (`/eis/config`)

- Enter and update your MRA API credentials
- Toggle between sandbox and production environments
- Enable or disable the integration
- Test connectivity to the MRA API

Credentials are encrypted with AES-256-CBC before being stored. The configuration page never displays the actual secret values -- it shows `***` for existing credentials.

### EIS Invoices (`/eis/invoices`)

A paginated list of all invoices submitted to MRA:

- **Search** by invoice number or MRA invoice ID
- **Filter** by status (All, Pending, Submitted, Approved, Rejected, Error)
- **Refresh status** for pending invoices (triggers a real-time check against MRA)
- **View details** in a slide-out modal showing full submission metadata
- **Pagination** for navigating large result sets

### EIS in the Sidebar

The sidebar navigation includes an **MRA EIS** section with three links:
- EIS Dashboard
- EIS Invoices
- EIS Configuration

---

## 7. Automatic Invoice Submission

When a tenant has `eisEnabled = true` and an active EIS subscription, the system automatically submits invoices to MRA from three transaction points:

### Sales (`POST /api/sales`)

Every completed sale is submitted to MRA immediately after the database transaction commits. The sale data is transformed into MRA's invoice format:

- `saleNumber` becomes the invoice number
- `saleDate` becomes the invoice date
- Sale items are mapped with descriptions, quantities, unit prices, and tax rates
- The tenant's TPIN and business details are included as the seller
- The client name (or "Walk-in Customer") is included as the buyer
- The payment method from the sale is passed through

### Invoices (`POST /api/invoices`)

Non-draft invoices are submitted automatically after creation. Draft invoices are not submitted -- they are only submitted when their status changes from Draft to an active status.

### Quotation Conversions (`POST /api/quotations/[id]/convert`)

When a quotation is converted to an invoice, the resulting invoice is submitted to MRA. The `sourceType` is recorded as `quotation-convert` so you can trace its origin.

### Failure Handling

If any EIS submission fails:
1. The original transaction (sale, invoice, quotation conversion) **is NOT affected** -- it completes successfully
2. An `EISInvoice` record is created with `status: "Error"` and the error message
3. The full error is logged in `EISSubmissionLog`
4. The error is printed to the server console
5. The API response to the client includes `eis: null` instead of submission details

---

## 8. API Reference

### `GET /api/eis/config`

Retrieve the current EIS configuration for the authenticated tenant.

**Auth:** Session required, EIS subscription required

**Response:**
```json
{
  "config": {
    "id": "clxyz...",
    "clientId": "my-client-id",
    "clientSecret": "***",
    "apiKey": "***",
    "environment": "sandbox",
    "isActive": true,
    "lastSyncAt": null,
    "syncStatus": null,
    "createdAt": "2026-03-04T12:00:00.000Z",
    "updatedAt": "2026-03-04T12:00:00.000Z"
  }
}
```

Returns `{ "config": null }` if no configuration exists.

---

### `POST /api/eis/config`

Save or update MRA API credentials.

**Auth:** Session required, EIS subscription required

**Request body:**
```json
{
  "clientId": "your-mra-client-id",
  "clientSecret": "your-mra-client-secret",
  "apiKey": "optional-api-key",
  "environment": "sandbox",
  "isActive": true
}
```

**Response:**
```json
{ "success": true, "message": "EIS configuration saved" }
```

**Notes:**
- `clientSecret` and `apiKey` are encrypted before storage
- When updating, omit `clientSecret` to keep the existing value
- Setting `isActive: false` disables EIS integration for the tenant

---

### `POST /api/eis/invoices/submit`

Manually submit an invoice to MRA.

**Auth:** Session required, EIS subscription required, quota check

**Request body:**
```json
{
  "invoiceData": {
    "invoiceNumber": "INV-2026-001",
    "invoiceDate": "2026-03-04",
    "customerName": "Customer Ltd",
    "customerTPIN": "87654321",
    "items": [
      {
        "description": "Product A",
        "quantity": 2,
        "unitPrice": 5000,
        "taxRate": 16.5
      }
    ],
    "subtotal": 10000,
    "taxTotal": 1650,
    "total": 11650
  },
  "sourceType": "invoice",
  "sourceId": "clxyz..."
}
```

**Response (success):**
```json
{
  "success": true,
  "data": {
    "success": true,
    "submissionId": "mra-sub-12345",
    "mraInvoiceId": "mra-inv-67890",
    "status": "Submitted",
    "submittedAt": "2026-03-04T14:30:00.000Z"
  }
}
```

**Error responses:**
- `403` -- No EIS subscription (`EIS_SUBSCRIPTION_REQUIRED`)
- `429` -- Monthly quota exceeded (`EIS_QUOTA_EXCEEDED`)
- `500` -- Submission failed (`EIS_SUBMISSION_ERROR`)

---

### `GET /api/eis/invoices`

List EIS invoices with pagination, filtering, and search.

**Auth:** Session required

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max 100) |
| `status` | string | `all` | Filter: `Pending`, `Submitted`, `Approved`, `Rejected`, `Error` |
| `search` | string | -- | Search by invoice number or MRA invoice ID |
| `startDate` | string | -- | Filter start date (ISO) |
| `endDate` | string | -- | Filter end date (ISO) |

**Response:**
```json
{
  "success": true,
  "data": [ { /* EISInvoice objects */ } ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

---

### `GET /api/eis/invoices/[id]/status`

Check and update the status of a specific EIS invoice. If the invoice is still Pending or Submitted, the system contacts MRA to fetch the latest status and updates the local record.

**Auth:** Session required

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "clxyz...",
    "invoiceNumber": "INV-2026-001",
    "status": "Approved",
    "mraInvoiceId": "mra-inv-67890",
    "submittedAt": "2026-03-04T14:30:00.000Z",
    "responseData": { /* MRA response */ }
  }
}
```

---

### `GET /api/eis/dashboard`

Retrieve comprehensive EIS dashboard statistics.

**Auth:** Session required, EIS subscription required

**Response:**
```json
{
  "success": true,
  "data": {
    "totalInvoices": 150,
    "approved": 130,
    "submitted": 10,
    "pending": 5,
    "rejected": 3,
    "errors": 2,
    "successRate": 86.7,
    "monthlyUsage": {
      "invoiceCount": 25,
      "submissionCount": 25,
      "approvedCount": 22,
      "rejectedCount": 1,
      "totalAmount": 1500000
    },
    "recentInvoices": [ /* last 10 EISInvoice objects */ ],
    "configuration": {
      "isActive": true,
      "environment": "production",
      "lastSyncAt": "2026-03-04T12:00:00.000Z",
      "syncStatus": "success"
    }
  }
}
```

---

### `GET /api/eis/health`

Check MRA API connectivity. Does not require authentication.

**Response (connected):**
```json
{
  "status": "healthy",
  "mraConnected": true,
  "latency": "234ms",
  "environment": "sandbox",
  "timestamp": "2026-03-04T14:30:00.000Z"
}
```

**Response (disconnected):**
```json
{
  "status": "unhealthy",
  "mraConnected": false,
  "error": "fetch failed",
  "latency": "5001ms",
  "environment": "sandbox",
  "timestamp": "2026-03-04T14:30:00.000Z"
}
```

HTTP status is `200` when healthy, `503` when unhealthy.

---

### `POST /api/cron/eis-sync`

Background job to sync statuses of pending/submitted invoices with MRA.

**Auth:** `Authorization: Bearer {CRON_SECRET}` header (if `CRON_SECRET` is set)

**Response:**
```json
{
  "success": true,
  "synced": 3,
  "total": 5,
  "timestamp": "2026-03-04T14:30:00.000Z"
}
```

---

## 9. Security

### Credential Encryption

MRA API credentials (Client Secret and API Key) are encrypted using **AES-256-CBC** before being stored in the database. The encryption uses:

- A 32-byte key from the `ENCRYPTION_KEY` environment variable
- A random 16-byte initialization vector (IV) generated for each encryption
- The encrypted value is stored as `IV:CIPHERTEXT` (hex-encoded)

The encryption key must be exactly:
- 64 hex characters (32 bytes), OR
- 32 ASCII characters (32 bytes)

Credentials are decrypted only at the moment of use (during MRA API calls) and are never returned in plaintext through any API response. The configuration API returns `***` for existing secrets.

### Access Control

- All EIS API endpoints require an authenticated session (`getUserFromSession`)
- EIS configuration and dashboard endpoints additionally check for an active EIS subscription (`hasEISAccess`)
- The cron sync endpoint uses a separate `CRON_SECRET` bearer token
- Tenant isolation is enforced -- users can only access their own tenant's EIS data

### Audit Trail

Every submission attempt is recorded in `EISSubmissionLog` with:
- The complete request payload sent to MRA
- The complete response received from MRA
- Whether it succeeded or failed
- Error codes and messages
- Exact duration in milliseconds
- Timestamp

This provides a full audit trail for compliance and debugging.

---

## 10. Subscription & Quotas

### EIS Plans

EIS is available on two subscription plans, defined in `lib/subscriptionConfig.js`:

| Plan ID | Name | Billing |
|---------|------|---------|
| `eis-monthly` | EIS Monthly | Monthly |
| `eis-yearly` | EIS Yearly | Annual |

### Quota Enforcement

Each plan has a monthly invoice submission quota. Before every submission (both automatic and manual), the system:

1. Checks `hasEISAccess(tenantId)` -- verifies the tenant has an active, non-trial EIS subscription
2. Calls `canSubmitEISInvoice(tenantId)` which:
   - Looks up the plan's quota via `getEISQuota(planId)`
   - Queries the current month's `EISUsage` record
   - Compares `usage.invoiceCount` against `quota.monthlyInvoices`
   - Returns `{ canSubmit: false, reason: 'Monthly invoice quota exceeded' }` if limit reached

If the quota is exceeded, the manual submit endpoint returns HTTP `429` with the quota details.

### Usage Tracking

The `EISUsage` table maintains per-tenant, per-month counters. These are updated atomically using Prisma `upsert` with `increment` operations after every submission attempt. The monthly period is determined by `YYYY-MM` format (e.g., `2026-03`).

---

## 11. Cron Jobs & Background Sync

### Invoice Status Sync

The `POST /api/cron/eis-sync` endpoint runs the `syncInvoiceStatuses()` method which:

1. Finds up to 100 `EISInvoice` records with status `Pending` or `Submitted` that were submitted more than 1 hour ago
2. For each, calls MRA's status endpoint to check the current status
3. If the status has changed, updates the local record
4. Updates usage statistics for newly Approved or Rejected invoices

### Setting Up the Cron Job

**Vercel** -- Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/eis-sync",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

**Self-hosted** -- Add to crontab:

```bash
# Run every 30 minutes
*/30 * * * * curl -s -X POST https://yourdomain.com/api/cron/eis-sync -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Docker / PM2** -- Use the same curl command in your scheduler.

The cron endpoint is protected by the `CRON_SECRET` environment variable. If `CRON_SECRET` is not set, the endpoint is open (useful for development).

---

## 12. Monitoring & Health Checks

### Health Endpoint

`GET /api/eis/health` provides a quick check of MRA API connectivity. Use this for:

- Uptime monitoring (e.g., UptimeRobot, Pingdom)
- Load balancer health checks
- Dashboard status indicators

The endpoint makes a lightweight request to MRA's `/system/health` endpoint with a 5-second timeout. It returns HTTP `200` when connected, `503` when not.

### Metrics to Watch

| Metric | Where to Find | Alert Threshold |
|--------|---------------|-----------------|
| Success rate | `/eis` dashboard | Below 90% |
| Pending invoices | `/eis/invoices?status=Pending` | Growing backlog |
| Error invoices | `/eis/invoices?status=Error` | Any errors |
| Monthly quota | `/eis` dashboard monthly usage | Above 80% of plan limit |
| MRA connectivity | `/api/eis/health` | Unhealthy status |
| Submission latency | `EISSubmissionLog.durationMs` | Above 10 seconds average |

### Database Queries for Monitoring

```sql
-- Failed submissions in the last 24 hours
SELECT * FROM "EISInvoice"
WHERE status = 'Error'
AND "createdAt" > NOW() - INTERVAL '24 hours'
ORDER BY "createdAt" DESC;

-- Submission success rate this month
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'Approved') as approved,
  ROUND(COUNT(*) FILTER (WHERE status = 'Approved') * 100.0 / NULLIF(COUNT(*), 0), 1) as success_rate
FROM "EISInvoice"
WHERE "createdAt" > DATE_TRUNC('month', NOW());

-- Average submission latency
SELECT
  AVG("durationMs") as avg_ms,
  MAX("durationMs") as max_ms,
  MIN("durationMs") as min_ms
FROM "EISSubmissionLog"
WHERE "createdAt" > NOW() - INTERVAL '24 hours';

-- Usage by tenant this month
SELECT t.name, u.*
FROM "EISUsage" u
JOIN "Tenant" t ON t.id = u."tenantId"
WHERE u."monthYear" = TO_CHAR(NOW(), 'YYYY-MM')
ORDER BY u."invoiceCount" DESC;
```

---

## 13. Troubleshooting

### "EIS subscription required" (HTTP 403)

**Cause:** The tenant does not have an active EIS subscription plan.

**Fix:** Ensure the tenant has an active `eis-monthly` or `eis-yearly` subscription in the `AccountSubscription` table. The subscription must be `isActive: true`, `isTrial: false`, and `expiresAt` must be in the future.

---

### "EIS configuration not found for tenant" (HTTP 500)

**Cause:** The tenant has not configured their MRA API credentials.

**Fix:** Navigate to `/eis/config` and enter the MRA Client ID, Client Secret, and optionally the API Key. Save the configuration.

---

### "MRA auth failed (401)"

**Cause:** The MRA Client ID or Client Secret is incorrect, or the credentials have expired.

**Fix:**
1. Verify the credentials with MRA
2. Go to `/eis/config` and re-enter the correct Client Secret
3. Ensure the correct environment (sandbox vs production) is selected
4. Test with: `curl -X POST https://dev-eis-api.mra.mw/auth/token -H "Content-Type: application/json" -d '{"client_id":"YOUR_ID","client_secret":"YOUR_SECRET","grant_type":"client_credentials"}'`

---

### "ENCRYPTION_KEY environment variable is not set"

**Cause:** The `ENCRYPTION_KEY` is missing from your environment.

**Fix:** Generate a key and add it to `.env`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output as `ENCRYPTION_KEY=<output>` in your `.env` file. Restart the application.

---

### "Monthly invoice quota exceeded" (HTTP 429)

**Cause:** The tenant has reached their monthly submission limit.

**Fix:**
- Check the current usage in `/eis` dashboard under "Current Month Usage"
- Upgrade to a higher EIS plan
- Wait for the next month when the counter resets

---

### Invoice shows "Error" status but the sale/invoice was saved

**This is expected behavior.** EIS submission is fire-and-forget -- it never blocks the original transaction. The sale or invoice is saved to the database first, then the EIS submission is attempted separately. If it fails, the error is recorded in the EIS tables but the business transaction is intact.

To resolve the EIS error:
1. Go to `/eis/invoices` and find the invoice with Error status
2. Click the eye icon to view the error details
3. Fix the underlying issue (credentials, TPIN, data format)
4. Re-submit manually via `/api/eis/invoices/submit`

---

### "MRA Disconnected" on the dashboard

**Cause:** The MRA API is unreachable from your server.

**Fix:**
1. Check if MRA's API is down (try `curl https://dev-eis-api.mra.mw/system/health`)
2. Check your server's network configuration and firewall rules
3. If self-hosted, ensure outbound HTTPS (port 443) is open to MRA's IP addresses
4. Check the `EIS_API_BASE_URL` environment variable for typos

---

### Invoices stuck in "Pending" or "Submitted" status

**Cause:** The background sync cron job may not be running, or MRA hasn't processed the invoices yet.

**Fix:**
1. Click the refresh icon on individual invoices in `/eis/invoices` to trigger an immediate status check
2. Verify the cron job is running: `curl -X POST https://yourdomain.com/api/cron/eis-sync -H "Authorization: Bearer YOUR_CRON_SECRET"`
3. Check if the cron job is configured (see Section 11)
4. Some invoices may take time for MRA to process -- wait and check again later

---

## 14. File Reference

| File | Purpose |
|------|---------|
| `lib/encryption.js` | AES-256-CBC encrypt/decrypt functions using `ENCRYPTION_KEY` |
| `lib/eisConfig.js` | MRA API endpoints, TPIN/invoice validation rules, environment resolution |
| `lib/eisService.js` | Core service: OAuth2 auth, invoice transformation, submission, status sync, usage tracking, health check |
| `lib/subscriptionConfig.js` | EIS plan definitions (`eis-monthly`, `eis-yearly`), quota config, helper functions |
| `lib/subscriptionService.js` | `hasEISAccess()`, `canSubmitEISInvoice()`, `getEISConfiguration()`, `getEISMonthlyUsage()` |
| `app/api/eis/config/route.js` | GET/POST for MRA credential management |
| `app/api/eis/invoices/submit/route.js` | Manual invoice submission endpoint |
| `app/api/eis/invoices/route.js` | Paginated EIS invoice list |
| `app/api/eis/invoices/[id]/status/route.js` | Single invoice status check/refresh |
| `app/api/eis/dashboard/route.js` | Dashboard statistics aggregation |
| `app/api/eis/health/route.js` | MRA connectivity health check |
| `app/api/cron/eis-sync/route.js` | Background sync for pending invoice statuses |
| `app/api/sales/route.js` | Sales POST handler (EIS hook at line ~1465) |
| `app/api/invoices/route.js` | Invoices POST handler (EIS hook at line ~803) |
| `app/api/quotations/[id]/convert/route.js` | Quotation convert handler (EIS hook at line ~197) |
| `app/api/tenant/settings/route.js` | Tenant settings (returns/saves `tpin`, `eisEnabled`) |
| `app/account/page.js` | Account page (TPIN input field) |
| `app/eis/page.js` | EIS Dashboard frontend |
| `app/eis/config/page.js` | EIS Configuration frontend |
| `app/eis/invoices/page.js` | EIS Invoices list frontend |
| `components/Sidebar/Sidebar.js` | Navigation sidebar (MRA EIS section) |
| `prisma/schema.prisma` | Database models: `EISInvoice`, `EISConfiguration`, `EISSubmissionLog`, `EISUsage` |
| `prisma/migrations/20260304120000_add_eis_tables/migration.sql` | Database migration |
