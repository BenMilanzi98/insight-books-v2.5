# MRA EIS (Electronic Invoice System) Implementation Guide

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [System Architecture](#system-architecture)
4. [Database Schema](#database-schema)
5. [Subscription Plans Configuration](#subscription-plans-configuration)
6. [API Integration](#api-integration)
7. [Frontend Implementation](#frontend-implementation)
8. [Security & Compliance](#security--compliance)
9. [Testing Strategy](#testing-strategy)
10. [MRA Approval Process](#mra-approval-process)
11. [Deployment](#deployment)
12. [Monitoring & Maintenance](#monitoring--maintenance)
13. [Troubleshooting](#troubleshooting)
14. [Appendices](#appendices)

---

## Overview

### What is MRA EIS?
The Malawi Revenue Authority (MRA) Electronic Invoice System (EIS) is a mandatory system for businesses to submit electronic invoices for tax compliance. Integration with MRA EIS allows InsightBooks users to:
- Generate MRA-compliant electronic invoices
- Submit invoices directly to MRA
- Track submission status and history
- Retrieve invoice validation results
- Generate MRA reports (VAT, PAYE, etc.)

### Integration Objectives
1. Provide seamless MRA EIS integration as a premium feature
2. Offer dedicated subscription plans (Monthly/Yearly) for EIS features
3. Enable admin management of EIS subscriptions via `/insightbooks/billing/subscriptions`
4. Enable tenants to configure TPIN in `/account`
5. Ensure MRA compliance and approval
6. Maintain high performance and reliability

### Key Features
- **EIS-Enabled Subscription Plans**: Separate plans with EIS capabilities
- **Invoice Submission**: Direct submission to MRA EIS API
- **Status Tracking**: Real-time tracking of invoice submission status
- **Validation**: Pre-submission validation against MRA rules
- **Reporting**: MRA-compliant reports and summaries
- **Audit Trail**: Complete logging for compliance
- **TPIN Management**: Configure Taxpayer Identification Number per tenant

---

## Prerequisites

### MRA EIS API Access
1. **API Credentials** (from MRA):
   - Client ID
   - Client Secret
   - API Key
   - Sandbox & Production endpoints
   - Certificate files (if required)

2. **MRA Registration**:
   - Taxpayer Identification Number (TPIN) - 8 digits
   - Business registration certificate
   - MRA EIS enrollment confirmation

### Technical Requirements
- Node.js 18+
- Next.js 14+ (existing)
- PostgreSQL 12+ (existing)
- Prisma ORM (existing)
- SSL/TLS certificates
- Environment variables configured

### Existing System Components
- ✅ Subscription management system (lib/subscriptionConfig.js)
- ✅ Admin billing interface (`/insightbooks/billing/subscriptions`)
- ✅ Payment gateway integration (PayChangu)
- ✅ Email notification system
- ✅ Multi-tenant architecture
- ✅ Account settings page (`/account`)
- ✅ Tenant settings (TenantSettings model)

---

## System Architecture

### High-Level Architecture
```
┌─────────────────┐
│   InsightBooks  │
│   Frontend      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Next.js API   │
│   Routes        │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   EIS Service Layer                 │
│   - Authentication                  │
│   - Invoice Formatting              │
│   - Validation                      │
│   - Submission                     │
│   - Retry Logic                    │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────┐
│   MRA EIS API   │
│   (Sandbox/Prod)│
└─────────────────┘
```

### Component Breakdown

#### 1. EIS Configuration Module
**Location**: `lib/eisConfig.js`
- Stores MRA API endpoints
- Manages credentials and certificates
- Environment-specific settings

#### 2. EIS Service Layer
**Location**: `lib/eisService.js`
- Core business logic for EIS operations
- Invoice transformation
- API communication
- Error handling and retries

#### 3. EIS API Routes
**Location**: `app/api/eis/*/route.js`
- RESTful endpoints for EIS operations
- Authentication middleware
- Rate limiting

#### 4. Subscription Integration
**Location**: `lib/subscriptionService.js` (extended)
- EIS plan detection (using existing `EIS_PLANS`, `EIS_PLAN_IDS`)
- Feature flagging based on subscription
- Usage tracking

#### 5. Frontend Components
**Location**: `app/eis/*` and components
- User-facing EIS interface
- Admin management tools
- Status dashboards
- TPIN configuration in `/account`

---

## Database Schema

### Existing Tables (Review)

#### AccountSubscription Table
```prisma
model AccountSubscription {
  id              String    @id @default(cuid())
  tenantId        String
  plan            String
  txRef           String    @unique
  amount          Float
  currency        String
  status          String    @default("Pending")
  paymentMethod   String?
  notes           String?
  isActive        Boolean   @default(false)
  startedAt       DateTime?
  expiresAt       DateTime?
  paymentDate     DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  gatewayResponse Json?
  isTrial         Boolean   @default(false)
  trialEndDate    DateTime?
  trialStartDate  DateTime?
  tenant          Tenant    @relation(fields: [tenantId], references: [id])

  @@index([tenantId])
  @@index([status])
  @@index([isActive])
  @@index([expiresAt])
  @@index([isTrial])
  @@index([trialEndDate])
}
```

#### Tenant Table Updates Required
Add TPIN field to support MRA compliance:

```prisma
// Add to existing Tenant model
model Tenant {
  // ... existing fields ...
  tpin            String?   // Taxpayer Identification Number for MRA EIS
  eisEnabled      Boolean   @default(false)  // Whether EIS is enabled for this tenant
  // ... existing relations ...
}
```

#### TenantSettings Table Updates Required
```prisma
// Add to existing TenantSettings model
model TenantSettings {
  // ... existing fields ...
  tpin            String?   // Taxpayer Identification Number for MRA EIS
  eisApiKey       String?   // Encrypted API key for MRA EIS
  eisClientSecret String?   // Encrypted client secret
  // ... existing fields ...
}
```

### New Tables Required

#### 1. EIS Invoice Table
```prisma
model EISInvoice {
  id                String    @id @default(cuid())
  tenantId          String
  subscriptionId    String?
  invoiceNumber     String    @unique
  mraInvoiceId      String?   // MRA's internal ID
  invoiceDate       DateTime
  totalAmount       Float
  taxAmount         Float
  status            String    // Pending, Submitted, Approved, Rejected, Error
  submissionId      String?   // MRA submission reference
  submittedAt       DateTime?
  responseData      Json?     // Full MRA response
  errorMessage      String?
  retryCount        Int       @default(0)
  lastRetryAt       DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  tenant            Tenant    @relation(fields: [tenantId], references: [id])
  subscription      AccountSubscription? @relation(fields: [subscriptionId], references: [id])

  @@index([tenantId])
  @@index([status])
  @@index([invoiceNumber])
  @@index([submittedAt])
  @@index([mraInvoiceId])
}
```

#### 2. EIS Configuration Table
```prisma
model EISConfiguration {
  id                String    @id @default(cuid())
  tenantId          String    @unique
  clientId          String
  clientSecret      String    // Should be encrypted
  apiKey            String?   // Should be encrypted
  environment       String    // sandbox | production
  isActive          Boolean   @default(true)
  lastSyncAt        DateTime?
  syncStatus        String?   // Success, Failed, InProgress
  settings          Json?     // Additional config (certificates, etc.)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  tenant            Tenant    @relation(fields: [tenantId], references: [id])

  @@index([tenantId])
  @@index([environment])
}
```

#### 3. EIS Submission Log Table
```prisma
model EISSubmissionLog {
  id                String    @id @default(cuid())
  tenantId          String
  invoiceId         String
  requestPayload    Json
  responsePayload   Json
  status            String
  errorCode         String?
  errorMessage      String?
  durationMs        Int
  createdAt         DateTime  @default(now())

  @@index([tenantId])
  @@index([invoiceId])
  @@index([createdAt])
}
```

#### 4. EIS Usage Tracking Table
```prisma
model EISUsage {
  id                String    @id @default(cuid())
  tenantId          String
  monthYear         String    // Format: YYYY-MM
  invoiceCount      Int       @default(0)
  submissionCount   Int       @default(0)
  approvedCount     Int       @default(0)
  rejectedCount     Int       @default(0)
  totalAmount       Float     @default(0)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@unique([tenantId, monthYear])
  @@index([tenantId])
  @@index([monthYear])
}
```

### Migration Script
Create: `prisma/migrations/20250101_add_eis_tables.sql`

```sql
-- Add TPIN column to Tenant table
ALTER TABLE "Tenant" ADD COLUMN "tpin" VARCHAR(20);
ALTER TABLE "Tenant" ADD COLUMN "eisEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Add TPIN and EIS credentials to TenantSettings
ALTER TABLE "TenantSettings" ADD COLUMN "tpin" VARCHAR(20);
ALTER TABLE "TenantSettings" ADD COLUMN "eisApiKey" TEXT;
ALTER TABLE "TenantSettings" ADD COLUMN "eisClientSecret" TEXT;

-- EISInvoice table
CREATE TABLE "EISInvoice" (
    "id" VARCHAR(255) NOT NULL,
    "tenantId" VARCHAR(255) NOT NULL,
    "subscriptionId" VARCHAR(255),
    "invoiceNumber" VARCHAR(255) NOT NULL,
    "mraInvoiceId" VARCHAR(255),
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "taxAmount" DOUBLE PRECISION NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "submissionId" VARCHAR(255),
    "submittedAt" TIMESTAMP(3),
    "responseData" JSONB,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EISInvoice_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EISInvoice_invoiceNumber_key" UNIQUE ("invoiceNumber"),
    CONSTRAINT "EISInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EISInvoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "AccountSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "EISInvoice_tenantId_idx" ON "EISInvoice"("tenantId");
CREATE INDEX "EISInvoice_status_idx" ON "EISInvoice"("status");
CREATE INDEX "EISInvoice_invoiceNumber_idx" ON "EISInvoice"("invoiceNumber");
CREATE INDEX "EISInvoice_submittedAt_idx" ON "EISInvoice"("submittedAt");
CREATE INDEX "EISInvoice_mraInvoiceId_idx" ON "EISInvoice"("mraInvoiceId");

-- EISConfiguration table
CREATE TABLE "EISConfiguration" (
    "id" VARCHAR(255) NOT NULL,
    "tenantId" VARCHAR(255) NOT NULL,
    "clientId" VARCHAR(255) NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "apiKey" VARCHAR(255),
    "environment" VARCHAR(50) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "syncStatus" VARCHAR(50),
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EISConfiguration_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EISConfiguration_tenantId_key" UNIQUE ("tenantId"),
    CONSTRAINT "EISConfiguration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "EISConfiguration_tenantId_idx" ON "EISConfiguration"("tenantId");
CREATE INDEX "EISConfiguration_environment_idx" ON "EISConfiguration"("environment");

-- EISSubmissionLog table
CREATE TABLE "EISSubmissionLog" (
    "id" VARCHAR(255) NOT NULL,
    "tenantId" VARCHAR(255) NOT NULL,
    "invoiceId" VARCHAR(255) NOT NULL,
    "requestPayload" JSONB NOT NULL,
    "responsePayload" JSONB NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "errorCode" VARCHAR(100),
    "errorMessage" TEXT,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EISSubmissionLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EISSubmissionLog_tenantId_idx" ON "EISSubmissionLog"("tenantId");
CREATE INDEX "EISSubmissionLog_invoiceId_idx" ON "EISSubmissionLog"("invoiceId");
CREATE INDEX "EISSubmissionLog_createdAt_idx" ON "EISSubmissionLog"("createdAt");

-- EISUsage table
CREATE TABLE "EISUsage" (
    "id" VARCHAR(255) NOT NULL,
    "tenantId" VARCHAR(255) NOT NULL,
    "monthYear" VARCHAR(7) NOT NULL, -- YYYY-MM
    "invoiceCount" INTEGER NOT NULL DEFAULT 0,
    "submissionCount" INTEGER NOT NULL DEFAULT 0,
    "approvedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EISUsage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EISUsage_tenantId_monthYear_key" UNIQUE ("tenantId", "monthYear"),
    CONSTRAINT "EISUsage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "EISUsage_tenantId_idx" ON "EISUsage"("tenantId");
CREATE INDEX "EISUsage_monthYear_idx" ON "EISUsage"("monthYear");
```

**Update Prisma Schema**:
Add to `prisma/schema.prisma`:

```prisma
// Add to Tenant model
tpin           String?   // Taxpayer Identification Number for MRA EIS
eisEnabled    Boolean   @default(false)  // Whether EIS is enabled for this tenant

// Add to TenantSettings model  
tpin           String?   // Taxpayer Identification Number for MRA EIS
eisApiKey     String?   // Encrypted API key for MRA EIS
eisClientSecret String? // Encrypted client secret

// EISInvoice, EISConfiguration, EISSubmissionLog, EISUsage models (as defined above)
```

Run migration:
```bash
npx prisma migrate dev --name add-eis-tables
npx prisma generate
```

---

## Subscription Plans Configuration

### Existing EIS Subscription Plans

The system already has EIS plans configured in [`lib/subscriptionConfig.js`](lib/subscriptionConfig.js:52). There are two simple plans - Monthly and Yearly:

```javascript
export const SUBSCRIPTION_PLANS = {
  // ... existing plans (ONE_MONTH, ONE_YEAR) ...

  // EIS Plans - Monthly and Yearly
  EIS_MONTHLY: {
    id: 'eis-monthly',
    name: 'EIS Monthly',
    displayName: 'EIS - Monthly',
    price: 150000, // MWK 150,000 per month
    priceFormatted: 'MK150,000',
    period: 'month',
    periodDisplay: '/month',
    currency: 'MWK',
    features: [
      "All Standard Features",
      "MRA EIS Integration",
      "Electronic Invoice Submission",
      "Invoice Status Tracking",
      "MRA Validation",
      "EIS Reports & Analytics",
      "Unlimited Invoices",
      "Priority Support"
    ],
    popular: true,
    highlight: true,
    badge: 'EIS',
    requiresEIS: true,
    eisQuota: {
      monthlyInvoices: Infinity,
      apiCalls: 10000
    }
  },

  EIS_YEARLY: {
    id: 'eis-yearly',
    name: 'EIS Yearly',
    displayName: 'EIS - Yearly',
    price: 950000, // MWK 950,000 per year
    priceFormatted: 'MK950,000',
    period: 'year',
    periodDisplay: '/year',
    currency: 'MWK',
    features: [
      "All Standard Features",
      "MRA EIS Integration",
      "Electronic Invoice Submission",
      "Invoice Status Tracking",
      "MRA Validation",
      "EIS Reports & Analytics",
      "Unlimited Invoices",
      "Priority Support",
      "2 Months Free"
    ],
    popular: false,
    highlight: false,
    badge: 'EIS',
    savings: 'Save MK850,000 with annual plan',
    requiresEIS: true,
    eisQuota: {
      monthlyInvoices: Infinity,
      apiCalls: 120000
    }
  }
};

export const EIS_PLANS = {
  MONTHLY: 'eis-monthly',
  YEARLY: 'eis-yearly'
};

export const EIS_PLAN_IDS = [
  EIS_PLANS.MONTHLY,
  EIS_PLANS.YEARLY
];
```

### Existing Helper Functions
The following functions already exist in [`lib/subscriptionConfig.js`](lib/subscriptionConfig.js:202):

```javascript
/**
 * Check if plan requires EIS
 */
export function isEISPlan(planId) {
  return EIS_PLAN_IDS.includes(planId);
}

/**
 * Get EIS quota for a plan
 */
export function getEISQuota(planId) {
  const plan = SUBSCRIPTION_PLANS[planId];
  if (plan && plan.requiresEIS) {
    return plan.eisQuota;
  }
  return null;
}
```

### Update Subscription Service

Add to [`lib/subscriptionService.js`](lib/subscriptionService.js):

```javascript
import { EIS_PLAN_IDS, getEISQuota } from './subscriptionConfig';

/**
 * Check if tenant has EIS-enabled subscription
 */
export async function hasEISAccess(tenantId) {
  const now = new Date();
  const subscription = await prisma.accountSubscription.findFirst({
    where: {
      tenantId,
      isActive: true,
      isTrial: false,
      plan: {
        in: EIS_PLAN_IDS // ['eis-monthly', 'eis-yearly']
      },
      expiresAt: {
        gt: now
      }
    }
  });

  return Boolean(subscription);
}

/**
 * Get EIS configuration for tenant
 */
export async function getEISConfiguration(tenantId) {
  const config = await prisma.eISConfiguration.findFirst({
    where: { tenantId, isActive: true }
  });
  return config;
}

/**
 * Check if tenant can submit EIS invoices (quota check)
 */
export async function canSubmitEISInvoice(tenantId) {
  const hasEIS = await hasEISAccess(tenantId);
  if (!hasEIS) {
    return { canSubmit: false, reason: 'No EIS subscription' };
  }

  const usage = await getEISMonthlyUsage(tenantId);
  const subscription = await getTenantSubscription(tenantId);
  const quota = getEISQuota(subscription.plan);

  if (quota && usage.invoiceCount >= quota.monthlyInvoices) {
    return { 
      canSubmit: false, 
      reason: 'Monthly invoice quota exceeded',
      quota: quota.monthlyInvoices,
      used: usage.invoiceCount
    };
  }

  return { canSubmit: true };
}
```

---

## API Integration

### MRA EIS API Endpoints

**Note**: The following endpoints are based on common MRA EIS implementations. Verify against the actual API documentation at:
- Swagger: https://eis-api.mra.mw/swagger/index.html
- API Guide: https://dev-eis-api.mra.mw/docs/

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/auth/token` | POST | Get OAuth2 access token |
| `/invoices/submit` | POST | Submit electronic invoice |
| `/invoices/status/{id}` | GET | Check submission status |
| `/invoices/list` | GET | List submitted invoices |
| `/invoices/validate` | POST | Validate invoice before submission |
| `/reports/vat-summary` | GET | VAT summary report |
| `/reports/paye-summary` | GET | PAYE summary report |
| `/system/health` | GET | API health check |

### EIS Service Implementation

Create `lib/eisService.js`:

```javascript
import prisma from '@/lib/prisma';
import { getEISConfiguration } from './subscriptionService';

class EISService {
  constructor() {
    this.baseUrl = process.env.EIS_API_BASE_URL || 'https://eis-api.mra.mw';
    this.timeout = 30000; // 30 seconds
  }

  /**
   * Get MRA API client for tenant
   */
  async getClient(tenantId) {
    const config = await getEISConfiguration(tenantId);
    if (!config) {
      throw new Error('EIS configuration not found for tenant');
    }

    return {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      apiKey: config.apiKey,
      environment: config.environment,
      baseUrl: this.baseUrl
    };
  }

  /**
   * Authenticate with MRA EIS API
   */
  async authenticate(tenantId) {
    try {
      const config = await getEISConfiguration(tenantId);
      if (!config) {
        throw new Error('EIS configuration not found');
      }

      const response = await fetch(`${this.baseUrl}/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          grant_type: 'client_credentials'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Authentication failed: ${error.message || response.statusText}`);
      }

      const data = await response.json();
      return data.access_token;
    } catch (error) {
      console.error('EIS Authentication error:', error);
      throw error;
    }
  }

  /**
   * Transform InsightBooks invoice to MRA EIS format
   */
  transformInvoice(invoice, tenant) {
    // Transform based on MRA EIS schema
    return {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate.toISOString().split('T')[0],
      seller: {
        name: tenant.name,
        tpin: tenant.tpin, // Taxpayer Identification Number - REQUIRED
        address: tenant.settings?.businessAddress || '',
        email: tenant.settings?.businessEmail || tenant.email,
        phone: tenant.settings?.businessPhone || ''
      },
      buyer: {
        name: invoice.customerName,
        tpin: invoice.customerTPIN || '',
        address: invoice.customerAddress || ''
      },
      items: invoice.items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalAmount: item.quantity * item.unitPrice,
        taxRate: item.taxRate,
        taxAmount: (item.quantity * item.unitPrice * item.taxRate) / 100
      })),
      totals: {
        subtotal: invoice.subtotal,
        taxTotal: invoice.taxTotal,
        total: invoice.total
      },
      currency: invoice.currency || 'MWK',
      paymentMethod: invoice.paymentMethod || 'Cash'
    };
  }

  /**
   * Submit invoice to MRA
   */
  async submitInvoice(tenantId, invoiceData) {
    const startTime = Date.now();
    
    try {
      // Get authentication token
      const token = await this.authenticate(tenantId);
      
      // Transform invoice
      const transformed = this.transformInvoice(invoiceData, await this.getTenant(tenantId));
      
      // Submit to MRA
      const response = await fetch(`${this.baseUrl}/invoices/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-API-Key': (await this.getClient(tenantId)).apiKey
        },
        body: JSON.stringify(transformed)
      });

      const duration = Date.now() - startTime;
      const responseData = await response.json();

      // Log submission
      await this.logSubmission(tenantId, invoiceData.id, {
        requestPayload: transformed,
        responsePayload: responseData,
        status: response.ok ? 'success' : 'error',
        errorCode: response.status.toString(),
        errorMessage: responseData.message || null,
        durationMs: duration
      });

      if (!response.ok) {
        throw new Error(responseData.message || 'Submission failed');
      }

      return {
        success: true,
        submissionId: responseData.submissionId,
        mraInvoiceId: responseData.invoiceId,
        status: responseData.status,
        submittedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('EIS Submit error:', error);
      throw error;
    }
  }

  /**
   * Check invoice submission status
   */
  async checkStatus(tenantId, submissionId) {
    try {
      const token = await this.authenticate(tenantId);
      
      const response = await fetch(`${this.baseUrl}/invoices/status/${submissionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-API-Key': (await this.getClient(tenantId)).apiKey
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch status');
      }

      return await response.json();
    } catch (error) {
      console.error('EIS Status check error:', error);
      throw error;
    }
  }

  /**
   * Validate invoice before submission
   */
  async validateInvoice(tenantId, invoiceData) {
    try {
      const token = await this.authenticate(tenantId);
      const transformed = this.transformInvoice(invoiceData, await this.getTenant(tenantId));
      
      const response = await fetch(`${this.baseUrl}/invoices/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-API-Key': (await this.getClient(tenantId)).apiKey
        },
        body: JSON.stringify(transformed)
      });

      return await response.json();
    } catch (error) {
      console.error('EIS Validation error:', error);
      throw error;
    }
  }

  /**
   * Log submission for audit
   */
  async logSubmission(tenantId, invoiceId, data) {
    try {
      await prisma.eISSubmissionLog.create({
        data: {
          tenantId,
          invoiceId,
          ...data
        }
      });
    } catch (error) {
      console.error('Failed to log submission:', error);
    }
  }

  /**
   * Get tenant details including TPIN
   */
  async getTenant(tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        settings: true
      }
    });
    
    if (!tenant) {
      throw new Error('Tenant not found');
    }
    
    return tenant;
  }

  /**
   * Sync invoice statuses (cron job)
   */
  async syncInvoiceStatuses() {
    // Find invoices with Pending/Submitted status that are older than 1 hour
    const pendingInvoices = await prisma.eISInvoice.findMany({
      where: {
        status: { in: ['Pending', 'Submitted'] },
        submittedAt: {
          lt: new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
        }
      },
      include: {
        tenant: {
          include: { settings: true }
        }
      }
    });

    for (const invoice of pendingInvoices) {
      try {
        if (!invoice.submissionId) {
          continue;
        }

        const status = await this.checkStatus(invoice.tenantId, invoice.submissionId);
        
        await prisma.eISInvoice.update({
          where: { id: invoice.id },
          data: {
            status: status.status,
            mraInvoiceId: status.mraInvoiceId,
            responseData: status,
            updatedAt: new Date()
          }
        });

        // Update usage stats if status changed to Approved/Rejected
        if (status.status === 'Approved' || status.status === 'Rejected') {
          await this.updateUsageStats(invoice.tenantId, status.status);
        }
      } catch (error) {
        console.error(`Failed to sync invoice ${invoice.id}:`, error);
      }
    }
  }

  /**
   * Update monthly usage statistics
   */
  async updateUsageStats(tenantId, status) {
    const now = new Date();
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    await prisma.eISUsage.upsert({
      where: {
        tenantId_monthYear: {
          tenantId,
          monthYear
        }
      },
      update: {
        invoiceCount: { increment: 1 },
        submissionCount: { increment: 1 },
        [status === 'Approved' ? 'approvedCount' : 'rejectedCount']: { increment: 1 },
        totalAmount: { increment: 0 }
      },
      create: {
        tenantId,
        monthYear,
        invoiceCount: 1,
        submissionCount: 1,
        [status === 'Approved' ? 'approvedCount' : 'rejectedCount']: 1,
        totalAmount: 0
      }
    });
  }
}

export default new EISService();
```

### API Routes

Create the following API routes:

#### 1. EIS Configuration Management
**Path**: `app/api/eis/config/route.js`

```javascript
import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encryption';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const config = await prisma.eISConfiguration.findFirst({
      where: { tenantId }
    });

    // Don't return encrypted secrets
    if (config) {
      return NextResponse.json({ 
        config: {
          ...config,
          clientSecret: config.clientSecret ? '***' : null,
          apiKey: config.apiKey ? '***' : null
        }
      });
    }

    return NextResponse.json({ config: null });
  } catch (error) {
    console.error('Error fetching EIS config:', error);
    return NextResponse.json({ error: 'Failed to fetch configuration' }, { status: 500 });
  }
}

export async function POST(request) {
  const userItem = await getUserFromSession(request);
  if (!userItem) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { clientId, clientSecret, apiKey, environment, isActive, settings } = body;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Missing required fields: clientId, clientSecret' },
        { status: 400 }
      );
    }

    const tenantId = userItem.tenantId;

    // Encrypt sensitive data
    const encryptedClientSecret = encrypt(clientSecret);
    const encryptedApiKey = apiKey ? encrypt(apiKey) : null;

    // Create or update configuration
    const config = await prisma.eISConfiguration.upsert({
      where: { tenantId },
      update: {
        clientId,
        clientSecret: encryptedClientSecret,
        apiKey: encryptedApiKey,
        environment: environment || 'sandbox',
        isActive: isActive !== false,
        settings,
        updatedAt: new Date()
      },
      create: {
        tenantId,
        clientId,
        clientSecret: encryptedClientSecret,
        apiKey: encryptedApiKey,
        environment: environment || 'sandbox',
        isActive: isActive !== false,
        settings
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving EIS config:', error);
    return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 });
  }
}

// Helper function for user authentication (add to lib/auth.js)
import { getUserFromSession } from '@/lib/auth';
```

#### 2. EIS Invoice Submission
**Path**: `app/api/eis/invoices/submit/route.js`

```javascript
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import eisService from '@/lib/eisService';
import { hasEISAccess, canSubmitEISInvoice } from '@/lib/subscriptionService';
import prisma from '@/lib/prisma';

export async function POST(request) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { invoiceData } = body;

    if (!invoiceData) {
      return NextResponse.json({ error: 'Invoice data is required' }, { status: 400 });
    }

    // Check EIS subscription
    const hasEIS = await hasEISAccess(user.tenantId);
    if (!hasEIS) {
      return NextResponse.json(
        { error: 'EIS subscription required', code: 'EIS_SUBSCRIPTION_REQUIRED' },
        { status: 403 }
      );
    }

    // Check quota
    const quotaCheck = await canSubmitEISInvoice(user.tenantId);
    if (!quotaCheck.canSubmit) {
      return NextResponse.json(
        { error: quotaCheck.reason, code: 'EIS_QUOTA_EXCEEDED', quota: quotaCheck },
        { status: 429 }
      );
    }

    // Validate invoice format
    const validation = await eisService.validateInvoice(user.tenantId, invoiceData);
    if (validation.errors && validation.errors.length > 0) {
      return NextResponse.json(
        { 
          error: 'Invoice validation failed', 
          errors: validation.errors,
          code: 'EIS_VALIDATION_FAILED'
        },
        { status: 400 }
      );
    }

    // Submit to MRA
    const result = await eisService.submitInvoice(user.tenantId, invoiceData);

    // Get active subscription for this tenant
    const subscription = await prisma.accountSubscription.findFirst({
      where: {
        tenantId: user.tenantId,
        isActive: true,
        plan: {
          in: ['eis-monthly', 'eis-yearly']
        }
      }
    });

    // Create EIS invoice record
    await prisma.eISInvoice.create({
      data: {
        tenantId: user.tenantId,
        subscriptionId: subscription?.id,
        invoiceNumber: invoiceData.invoiceNumber,
        mraInvoiceId: result.mraInvoiceId,
        invoiceDate: new Date(invoiceData.invoiceDate),
        totalAmount: invoiceData.total,
        taxAmount: invoiceData.taxTotal,
        status: result.status,
        submissionId: result.submissionId,
        submittedAt: new Date(result.submittedAt),
        responseData: result
      }
    });

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('EIS Submit error:', error);
    return NextResponse.json(
      { error: error.message, code: 'EIS_SUBMISSION_ERROR' },
      { status: 500 }
    );
  }
}
```

#### 3. EIS Status Check
**Path**: `app/api/eis/invoices/[id]/status/route.js`

```javascript
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import eisService from '@/lib/eisService';
import prisma from '@/lib/prisma';

export async function GET(request, { params }) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params; // EIS invoice ID or submission ID
    
    const invoice = await prisma.eISInvoice.findFirst({
      where: {
        OR: [
          { id },
          { submissionId: id }
        ],
        tenantId: user.tenantId
      }
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // If we have a submission ID, check with MRA
    if (invoice.submissionId) {
      const status = await eisService.checkStatus(user.tenantId, invoice.submissionId);
      
      // Update invoice status if changed
      if (status.status !== invoice.status) {
        await prisma.eISInvoice.update({
          where: { id },
          data: {
            status: status.status,
            responseData: status,
            updatedAt: new Date()
          }
        });

        // Update usage if approved/rejected
        if (status.status === 'Approved' || status.status === 'Rejected') {
          await eisService.updateUsageStats(user.tenantId, status.status);
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          ...invoice,
          currentStatus: status
        }
      });
    }

    return NextResponse.json({ success: true, data: invoice });

  } catch (error) {
    console.error('EIS Status check error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

#### 4. EIS Dashboard/List
**Path**: `app/api/eis/invoices/route.js`

```javascript
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where = {
      tenantId: user.tenantId
    };

    if (status) {
      where.status = status;
    }

    if (startDate && endDate) {
      where.invoiceDate = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const [invoices, total] = await Promise.all([
      prisma.eISInvoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.eISInvoice.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      data: invoices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('EIS List error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

---

## Frontend Implementation

### 1. TPIN Configuration in Account Page

**Path**: `app/account/page.js`

Add TPIN field to the Business Info tab. Update the existing form:

```javascript
// In the Business Information section, add:
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Taxpayer Identification Number (TPIN) *
  </label>
  <input
    type="text"
    value={settings.tpin || ''}
    onChange={(e) => handleChange('tpin', e.target.value)}
    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
    placeholder="12345678"
    maxLength={8}
    minLength={8}
  />
  <p className="mt-1 text-xs text-gray-500">
    8-digit TPIN from Malawi Revenue Authority (required for MRA EIS)
  </p>
</div>
```

Update `settings` state to include TPIN:
```javascript
const [settings, setSettings] = useState({
  // ... existing fields ...
  tpin: '',  // Add this
});
```

Update `loadSettings` to fetch TPIN:
```javascript
const loadSettings = async () => {
  // ... existing load logic ...
  
  setSettings({
    // ... existing fields ...
    tpin: tenantData.tpin || '',
  });
};
```

Update `handleSubmit` to save TPIN:
```javascript
const handleSubmit = async (e) => {
  // ... existing logic ...
  
  const tenantResponse = await fetch("/api/tenant/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      // ... existing fields ...
      tpin: settings.tpin,
    }),
  });
};
```

Create API endpoint to update TPIN: `app/api/tenant/settings/route.js`

### 2. EIS Configuration Page

**Path**: `app/eis/config/page.js`

```javascript
"use client";
import { useState, useEffect } from 'react';
import { 
  Settings, 
  Save, 
  Eye, 
  EyeOff,
  CheckCircle,
  AlertCircle,
  Loader2,
  Shield
} from 'lucide-react';
import { useSession } from 'next-auth/react';

export default function EISConfigPage() {
  const { data: session } = useSession();
  const [config, setConfig] = useState({
    clientId: '',
    clientSecret: '',
    apiKey: '',
    environment: 'sandbox',
    isActive: true
  });
  const [showSecrets, setShowSecrets] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/eis/config');
      if (response.ok) {
        const data = await response.json();
        if (data.config) {
          setConfig({
            clientId: data.config.clientId || '',
            clientSecret: data.config.clientSecret === '***' ? '' : data.config.clientSecret || '',
            apiKey: data.config.apiKey === '***' ? '' : data.config.apiKey || '',
            environment: data.config.environment || 'sandbox',
            isActive: data.config.isActive !== false
          });
          setIsConnected(true);
        }
      }
    } catch (error) {
      console.error('Failed to fetch config:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/eis/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      const result = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Configuration saved successfully!' });
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to save configuration' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/eis/health');
      if (response.ok) {
        setMessage({ type: 'success', text: 'Connection to MRA EIS successful!' });
      } else {
        setMessage({ type: 'error', text: 'Connection failed. Check your credentials.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Cannot connect to MRA EIS' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center">
          <Shield className="h-8 w-8 text-indigo-600 mr-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">MRA EIS Configuration</h1>
            <p className="text-gray-600 mt-1">
              Configure your MRA Electronic Invoice System integration
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg mb-6 ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          <div className="flex items-center">
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5 mr-2" />
            ) : (
              <AlertCircle className="h-5 w-5 mr-2" />
            )}
            {message.text}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center mb-4">
            <Settings className="h-5 w-5 mr-2 text-indigo-600" />
            <h2 className="text-lg font-semibold">API Credentials</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client ID
              </label>
              <input
                type="text"
                value={config.clientId}
                onChange={(e) => setConfig({...config, clientId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client Secret
              </label>
              <div className="relative">
                <input
                  type={showSecrets ? 'text' : 'password'}
                  value={config.clientSecret}
                  onChange={(e) => setConfig({...config, clientSecret: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowSecrets(!showSecrets)}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showSecrets ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key (Optional)
              </label>
              <input
                type={showSecrets ? 'text' : 'password'}
                value={config.apiKey}
                onChange={(e) => setConfig({...config, apiKey: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 pr-10"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Environment
              </label>
              <select
                value={config.environment}
                onChange={(e) => setConfig({...config, environment: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="sandbox">Sandbox (Testing)</option>
                <option value="production">Production (Live)</option>
              </select>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={config.isActive}
                onChange={(e) => setConfig({...config, isActive: e.target.checked})}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                Enable EIS Integration
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Configuration
          </button>

          <button
            type="button"
            onClick={testConnection}
            disabled={isLoading || !config.clientId}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            Test Connection
          </button>
        </div>
      </form>

      {isConnected && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <span className="text-green-800 font-medium">EIS Configuration Active</span>
          </div>
          <p className="text-green-700 text-sm mt-1">
            Your MRA EIS integration is configured and ready to use.
          </p>
        </div>
      )}
    </div>
  );
}
```

### 3. EIS Invoices Dashboard

**Path**: `app/eis/invoices/page.js`

```javascript
"use client";
import { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  Filter,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

export default function EISInvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    fetchInvoices();
  }, [page, statusFilter]);

  const fetchInvoices = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(statusFilter !== 'all' && { status: statusFilter })
      });

      const response = await fetch(`/api/eis/invoices?${params}`);
      if (response.ok) {
        const data = await response.json();
        setInvoices(data.data);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Approved':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'Rejected':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'Submitted':
        return <Clock className="h-5 w-5 text-blue-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      Approved: 'bg-green-100 text-green-800',
      Rejected: 'bg-red-100 text-red-800',
      Submitted: 'bg-blue-100 text-blue-800',
      Pending: 'bg-yellow-100 text-yellow-800',
      Error: 'bg-red-100 text-red-800'
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">MRA EIS Invoices</h1>
        <p className="text-gray-600 mt-2">
          Track and manage your MRA electronic invoice submissions
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by invoice number or MRA ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Submitted">Submitted</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Error">Error</option>
          </select>

          <button
            onClick={() => fetchInvoices()}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No invoices</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by creating and submitting your first invoice to MRA.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    MRA Invoice ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {invoice.invoiceNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(invoice.invoiceDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      MWK {invoice.totalAmount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {invoice.mraInvoiceId || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(invoice.status)}
                        <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(invoice.status)}`}>
                          {invoice.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {invoice.submittedAt 
                        ? new Date(invoice.submittedAt).toLocaleString()
                        : '-'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => window.open(`/eis/invoices/${invoice.id}`, '_blank')}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{(page - 1) * 20 + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(page * 20, pagination.total)}</span> of{' '}
                  <span className="font-medium">{pagination.total}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                    disabled={page === pagination.pages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

### 4. Update Subscription Management Page

The existing [`/insightbooks/billing/subscriptions`](app/insightbooks/billing/subscriptions/page.js) page already has comprehensive functionality. Add EIS-specific features:

1. **Filter EIS subscriptions**: Add a filter for EIS plans
2. **EIS Configuration quick link**: Add button to configure EIS for tenant
3. **EIS Usage display**: Show EIS invoice count in subscription details

Add to the existing page:

```javascript
// In the filter section, add:
const [planFilter, setPlanFilter] = useState('all');

// Add EIS plan filter options:
<select
  value={planFilter}
  onChange={(e) => setPlanFilter(e.target.value)}
  className="px-3 py-2 border border-gray-300 rounded-md"
>
  <option value="all">All Plans</option>
  <option value="eis">EIS Plans Only</option>
  <option value="standard">Standard Only</option>
  <option value="professional">Professional Only</option>
  <option value="non-eis">Non-EIS Plans</option>
</select>

// Update filteredSubscriptions logic:
const filteredSubscriptions = subscriptions.filter(subscription => {
  const matchesSearch = /* existing logic */;
  const matchesStatus = statusFilter === 'all' || subscription.status === statusFilter;
  
  // EIS plan filter
  let matchesPlan = true;
  if (planFilter === 'eis') {
    matchesPlan = isEISPlan(subscription.plan);
  } else if (planFilter === 'non-eis') {
    matchesPlan = !isEISPlan(subscription.plan);
  } else if (planFilter === 'standard') {
    matchesPlan = subscription.plan.includes('standard');
  } else if (planFilter === 'professional') {
    matchesPlan = subscription.plan.includes('professional');
  }
  
  return matchesSearch && matchesStatus && matchesPlan;
});
```

---

## Security & Compliance

### 1. Data Encryption

All sensitive MRA data must be encrypted:

```javascript
// lib/encryption.js
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32 bytes for AES-256
const IV_LENGTH = 16;

export function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(encryptedText) {
  if (!encryptedText) return null;
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

Use for storing MRA credentials:

```javascript
// In EIS configuration save
import { encrypt } from '@/lib/encryption';

const encryptedClientSecret = encrypt(body.clientSecret);
const encryptedApiKey = body.apiKey ? encrypt(body.apiKey) : null;

await prisma.eISConfiguration.create({
  data: {
    clientId: body.clientId,
    clientSecret: encryptedClientSecret,
    apiKey: encryptedApiKey,
    // ...
  }
});
```

### 2. Access Control

All EIS endpoints must have proper authorization:

```javascript
// Middleware: requireEISAccess
export async function requireEISAccess(request) {
  const user = await getSessionUser(request);
  
  if (!user) {
    return { error: 'Unauthorized', status: 401 };
  }

  const hasEIS = await hasEISAccess(user.tenantId);
  
  if (!hasEIS) {
    return { 
      error: 'EIS subscription required', 
      code: 'EIS_SUBSCRIPTION_REQUIRED',
      status: 403 
    };
  }

  return { user };
}
```

### 3. Audit Logging

All EIS operations must be logged:

```javascript
// lib/auditLogger.js
export async function logEISEvent(tenantId, userId, action, details) {
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      module: 'EIS',
      action,
      details: JSON.stringify(details),
      ipAddress: getClientIP(),
      userAgent: getUserAgent(),
      timestamp: new Date()
    }
  });
}

// Usage:
await logEISEvent(user.tenantId, user.id, 'INVOICE_SUBMIT', {
  invoiceNumber: invoice.invoiceNumber,
  totalAmount: invoice.total,
  submissionId: result.submissionId
});
```

### 4. GDPR & Data Privacy

- Store only necessary taxpayer information
- Implement data retention policies (7 years as per MRA requirements)
- Provide data export/deletion capabilities
- Encrypt all personal data
- TPIN validation (8 digits, numeric only)

---

## Testing Strategy

### 1. Unit Tests

**Test files**: `__tests__/eis/`

```javascript
// __tests__/eis/eisService.test.js
import eisService from '@/lib/eisService';
import { hasEISAccess } from '@/lib/subscriptionService';

jest.mock('@/lib/prisma');
jest.mock('@/lib/subscriptionService');

describe('EIS Service', () => {
  test('should transform invoice correctly', async () => {
    const invoice = {
      invoiceNumber: 'INV-001',
      invoiceDate: new Date('2025-01-15'),
      customerName: 'Test Customer',
      total: 50000,
      taxTotal: 7500,
      items: [
        {
          description: 'Product A',
          quantity: 2,
          unitPrice: 20000,
          taxRate: 15
        }
      ]
    };

    const tenant = {
      id: 'tenant-1',
      name: 'Test Company',
      tpin: '12345678',
      settings: {
        businessAddress: 'Blantyre, Malawi',
        businessEmail: 'test@example.com',
        businessPhone: '+265123456789'
      },
      email: 'test@example.com'
    };

    const transformed = eisService.transformInvoice(invoice, tenant);

    expect(transformed.invoiceNumber).toBe('INV-001');
    expect(transformed.seller.tpin).toBe('12345678');
    expect(transformed.totals.total).toBe(50000);
    expect(transformed.items.length).toBe(1);
  });

  test('should handle authentication errors gracefully', async () => {
    // Mock failed authentication
    const mockAuth = jest.spyOn(eisService, 'authenticate');
    mockAuth.mockRejectedValue(new Error('Invalid credentials'));

    await expect(
      eisService.submitInvoice('tenant-1', {})
    ).rejects.toThrow('Invalid credentials');
  });
});
```

### 2. Integration Tests

```javascript
// __tests__/eis/integration.test.js
import { testEISFlow } from './testUtils';

describe('EIS Integration', () => {
  test('complete invoice submission flow', async () => {
    const result = await testEISFlow({
      createInvoice: true,
      submit: true,
      checkStatus: true
    });

    expect(result.success).toBe(true);
    expect(result.submissionId).toBeDefined();
    expect(result.status).toBe('Submitted');
  });

  test('quota enforcement', async () => {
    // Exceed quota
    const result = await testEISFlow({
      exceedQuota: true
    });

    expect(result.error.code).toBe('EIS_QUOTA_EXCEEDED');
  });
});
```

### 3. Sandbox Testing

Create a sandbox testing environment:

```bash
# .env.local
EIS_API_BASE_URL=https://dev-eis-api.mra.mw
EIS_CLIENT_ID=your_sandbox_client_id
EIS_CLIENT_SECRET=your_sandbox_client_secret
EIS_ENVIRONMENT=sandbox
```

Test script: `scripts/test-eis-sandbox.js`

```javascript
import eisService from '@/lib/eisService';

async function testSandbox() {
  try {
    // Test authentication
    const token = await eisService.authenticate('test-tenant-id');
    console.log('✅ Authentication successful');

    // Test invoice validation
    const validation = await eisService.validateInvoice('test-tenant-id', sampleInvoice);
    console.log('✅ Validation response:', validation);

    // Test submission (use test invoice)
    const result = await eisService.submitInvoice('test-tenant-id', sampleInvoice);
    console.log('✅ Submission successful:', result);

  } catch (error) {
    console.error('❌ Sandbox test failed:', error.message);
  }
}

testSandbox();
```

### 4. End-to-End Tests

Using Cypress or Playwright:

```javascript
// cypress/e2e/eis.cy.js
describe('EIS Integration', () => {
  it('should configure EIS settings', () => {
    cy.loginAsAdmin();
    cy.visit('/insightbooks/billing/subscriptions');
    cy.get('[data-testid="eis-config-btn"]').click();
    cy.get('[name="clientId"]').type('test-client-id');
    cy.get('[name="clientSecret"]').type('test-secret');
    cy.get('button[type="submit"]').click();
    cy.contains('Configuration saved').should('be.visible');
  });

  it('should submit invoice to MRA', () => {
    cy.loginAsUser();
    cy.visit('/eis/invoices/new');
    cy.get('[name="invoiceNumber"]').type('TEST-INV-001');
    // Fill form...
    cy.get('button[type="submit"]').click();
    cy.contains('submitted successfully').should('be.visible');
  });
});
```

---

## MRA Approval Process

### Pre-Approval Requirements

1. **Technical Documentation**:
   - API integration specification
   - Data flow diagrams
   - Security measures documentation
   - Error handling procedures

2. **Testing**:
   - Complete sandbox testing with MRA test credentials
   - Submit test invoices (minimum 10)
   - Verify all response scenarios
   - Document test results

3. **Compliance**:
   - Data encryption implementation
   - Access control mechanisms
   - Audit trail functionality
   - Backup and recovery procedures
   - TPIN validation and management

### Submission Package

Prepare the following for MRA approval:

#### 1. Integration Document
```
MRA-EIS-Integration-InsightBooks-YYYY-MM-DD.pdf
```
Contents:
- Company overview
- System architecture diagram
- API endpoints used
- Data formats (sample requests/responses)
- Error handling strategy
- Security implementation details
- TPIN management workflow

#### 2. Test Results
```
MRA-EIS-Test-Results-YYYY-MM-DD.xlsx
```
Columns:
| Test Case | Scenario | Expected Result | Actual Result | Status | Date |
|-----------|----------|-----------------|---------------|--------|------|

#### 3. Certificate of Compliance
```
MRA-EIS-Compliance-Certificate.pdf
```
- Signed by authorized representative
- Stating compliance with MRA EIS technical specifications
- Company registration details
- TPIN number

### Approval Timeline

| Stage | Duration | Notes |
|-------|----------|-------|
| Document Submission | Day 1 | Submit complete package |
| Initial Review | 3-5 days | MRA reviews documentation |
| Sandbox Testing | 7-14 days | Test with MRA sandbox |
| Issue Resolution | 3-7 days | Address any findings |
| Final Approval | 2-3 days | Receive approval letter |

**Total Estimated Time**: 2-3 weeks

### Post-Approval Requirements

1. **Production Credentials**: Receive production API credentials from MRA
2. **Go-Live Checklist**:
   - [ ] Switch to production endpoints
   - [ ] Update credentials
   - [ ] Perform smoke test
   - [ ] Monitor first 24 hours
   - [ ] Submit first production invoice

3. **Ongoing Compliance**:
   - Monthly reconciliation reports
   - Quarterly security audits
   - Annual recertification
   - Incident reporting (within 24 hours)

---

## Deployment

### Environment Configuration

**`.env.local`** (development):
```env
# MRA EIS Configuration
EIS_API_BASE_URL=https://dev-eis-api.mra.mw
EIS_CLIENT_ID=your_sandbox_client_id
EIS_CLIENT_SECRET=your_sandbox_client_secret
EIS_API_KEY=your_sandbox_api_key
EIS_ENVIRONMENT=sandbox

# Encryption
ENCRYPTION_KEY=your-32-byte-encryption-key-here

# Cron Jobs
CRON_SECRET=your-cron-secret-key
```

**Production environment variables** (set in hosting platform):
```env
EIS_API_BASE_URL=https://eis-api.mra.mw
EIS_CLIENT_ID=prod_client_id
EIS_CLIENT_SECRET=prod_client_secret
EIS_API_KEY=prod_api_key
EIS_ENVIRONMENT=production
ENCRYPTION_KEY=production-32-byte-key
```

### Deployment Steps

1. **Database Migration**:
```bash
npx prisma migrate deploy
npx prisma generate
```

2. **Build Application**:
```bash
npm run build
```

3. **Environment Setup**:
   - Set all environment variables
   - Upload SSL certificates if required
   - Configure firewall rules for MRA IP whitelist (if applicable)

4. **Deploy to Production**:
```bash
# Vercel
vercel --prod

# Docker
docker-compose -f docker-compose.prod.yml up -d

# Manual
npm start
```

5. **Configure Cron Jobs**:

For Vercel/Netlify, use their cron service:

**Vercel Cron** (`vercel.json`):
```json
{
  "crons": [
    {
      "path": "/api/cron/eis-sync",
      "schedule": "*/30 * * * *"
    },
    {
      "path": "/api/cron/eis-usage-report",
      "schedule": "0 2 * * *"
    }
  ]
}
```

For self-hosted, use system cron:

```bash
# crontab -e
*/30 * * * * cd /path/to/app && curl -X POST https://yourdomain.com/api/cron/eis-sync -H "Authorization: Bearer $CRON_SECRET"
0 2 * * * cd /path/to/app && curl -X POST https://yourdomain.com/api/cron/eis-usage-report -H "Authorization: Bearer $CRON_SECRET"
```

### Cron Job Endpoints

**EIS Sync** (`app/api/cron/eis-sync/route.js`):
```javascript
import { NextResponse } from 'next/server';
import eisService from '@/lib/eisService';

export async function POST(request) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Sync pending invoices
    await eisService.syncInvoiceStatuses();

    return NextResponse.json({ 
      success: true, 
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    console.error('EIS Sync cron error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

---

## Monitoring & Maintenance

### 1. Health Checks

**Endpoint**: `app/api/eis/health/route.js`

```javascript
import { NextResponse } from 'next/server';
import eisService from '@/lib/eisService';

export async function GET() {
  try {
    // Test MRA connectivity
    const startTime = Date.now();
    const response = await fetch(`${process.env.EIS_API_BASE_URL}/system/health`, {
      method: 'GET',
      timeout: 5000
    });
    const latency = Date.now() - startTime;

    return NextResponse.json({
      status: response.ok ? 'healthy' : 'unhealthy',
      mraConnected: response.ok,
      latency: `${latency}ms`,
      timestamp: new Date().toISOString(),
      environment: process.env.EIS_ENVIRONMENT
    });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      mraConnected: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 503 });
  }
}
```

### 2. Metrics to Monitor

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `eis_submission_success_rate` | % of successful submissions | < 95% |
| `eis_submission_latency` | Average submission time | > 10s |
| `eis_quota_usage` | % of monthly quota used | > 80% |
| `eis_error_rate` | % of failed submissions | > 5% |
| `eis_api_response_time` | MRA API response time | > 5s |

### 3. Alerting

Set up alerts for:
- Failed submissions (retry count > 3)
- Quota exceeding 80%
- MRA API downtime
- Authentication failures
- Unusual submission patterns
- TPIN validation failures

### 4. Logging

Structured logging format:

```javascript
const eisLog = {
  timestamp: new Date().toISOString(),
  tenantId: user.tenantId,
  userId: user.id,
  action: 'INVOICE_SUBMIT',
  invoiceNumber: invoice.invoiceNumber,
  submissionId: result.submissionId,
  status: result.status,
  latency: duration,
  userAgent: request.headers.get('user-agent'),
  ip: getClientIP(request)
};

console.log(JSON.stringify(eisLog));
```

### 5. Backup & Recovery

**Daily Backups**:
```bash
# Backup EIS tables
pg_dump -t EISInvoice -t EISConfiguration -t EISSubmissionLog -t EISUsage $DATABASE_URL > eis_backup_$(date +%Y%m%d).sql

# Store securely (encrypted)
gpg --encrypt --recipient 'your-email@example.com' eis_backup_*.sql
```

**Recovery Procedure**:
1. Restore database from latest backup
2. Re-sync with MRA for missing invoices
3. Verify data integrity
4. Notify affected tenants if needed

---

## Troubleshooting

### Common Issues

#### 1. Authentication Failures
**Symptom**: `401 Unauthorized` from MRA API

**Causes**:
- Invalid client credentials
- Expired token
- Wrong environment (sandbox vs production)

**Solution**:
```bash
# Verify credentials in admin panel
# Test authentication manually:
curl -X POST https://dev-eis-api.mra.mw/auth/token \
  -H "Content-Type: application/json" \
  -d '{"client_id":"YOUR_ID","client_secret":"YOUR_SECRET","grant_type":"client_credentials"}'
```

#### 2. TPIN Validation Errors
**Symptom**: Invoices failing validation

**Causes**:
- TPIN not set in account settings
- TPIN format incorrect (must be 8 digits)
- TPIN not registered with MRA

**Solution**:
- Navigate to `/account` and verify TPIN is set
- TPIN must be exactly 8 digits
- Contact MRA to verify TPIN registration

#### 3. Quota Exceeded
**Symptom**: `429 Too Many Requests`

**Solution**:
- Check tenant's subscription plan at `/insightbooks/billing/subscriptions`
- Upgrade to higher EIS plan
- Implement rate limiting on your side
- Contact MRA for quota increase if needed

#### 4. Invoice Validation Errors
**Symptom**: `400 Bad Request` with validation errors

**Solution**:
- Review MRA invoice schema requirements
- Ensure all required fields are present
- Validate TPIN format (8 digits)
- Check date format (YYYY-MM-DD)
- Verify tax calculations

#### 5. Slow Submissions
**Symptom**: Submissions taking > 30 seconds

**Solution**:
- Implement async submission with webhook
- Increase timeout to 60 seconds
- Check network connectivity
- Contact MRA support for API performance issues

#### 6. Duplicate Submissions
**Symptom**: Same invoice submitted multiple times

**Solution**:
- Implement idempotency keys (use invoiceNumber)
- Check existing submissions before retry
- Use database unique constraint on invoiceNumber

### Debug Commands

```bash
# Check EIS configuration for tenant
npx prisma db execute --stdin <<EOF
SELECT * FROM "EISConfiguration" WHERE "tenantId" = 'tenant-id';
EOF

# Find failed submissions
npx prisma db execute --stdin <<EOF
SELECT * FROM "EISInvoice" 
WHERE "status" = 'Error' 
ORDER BY "createdAt" DESC 
LIMIT 10;
EOF

# Check submission logs
npx prisma db execute --stdin <<EOF
SELECT * FROM "EISSubmissionLog" 
WHERE "status" = 'error' 
ORDER BY "createdAt" DESC 
LIMIT 20;
EOF

# View usage statistics
npx prisma db execute --stdin <<EOF
SELECT * FROM "EISUsage" 
WHERE "tenantId" = 'tenant-id' 
ORDER BY "monthYear" DESC;
EOF

# Check tenant TPIN
npx prisma db execute --stdin <<EOF
SELECT id, name, tpin, "eisEnabled" FROM "Tenant" 
WHERE tpin IS NOT NULL;
EOF
```

### Support Contacts

**MRA EIS Support**:
- Email: eis-support@mra.mw
- Phone: +265 1 822 000
- Hours: Monday-Friday, 8:00-16:30 (CAT)

**Internal Support**:
- Check logs: `logs/eis-error.log`
- Database: Verify EIS tables integrity
- Monitoring: Check Grafana/Prometheus dashboards

---

## Appendices

### Appendix A: MRA EIS API Specification

**Note**: Verify actual endpoints at https://eis-api.mra.mw/swagger/index.html

#### Authentication
```
POST /auth/token
Content-Type: application/json

{
  "client_id": "string",
  "client_secret": "string",
  "grant_type": "client_credentials"
}

Response:
{
  "access_token": "string",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

#### Submit Invoice
```
POST /invoices/submit
Authorization: Bearer {token}
X-API-Key: {apiKey}
Content-Type: application/json

{
  "invoiceNumber": "INV-2025-001",
  "invoiceDate": "2025-01-15",
  "seller": {
    "name": "Company Name",
    "tpin": "12345678",
    "address": "Full address",
    "email": "email@example.com",
    "phone": "+265123456789"
  },
  "buyer": {
    "name": "Customer Name",
    "tpin": "87654321",
    "address": "Customer address"
  },
  "items": [
    {
      "description": "Product/Service",
      "quantity": 2,
      "unitPrice": 25000,
      "totalAmount": 50000,
      "taxRate": 16.5,
      "taxAmount": 8250
    }
  ],
  "totals": {
    "subtotal": 50000,
    "taxTotal": 8250,
    "total": 58250
  },
  "currency": "MWK",
  "paymentMethod": "Cash|Bank Transfer|Cheque|Card"
}

Response:
{
  "success": true,
  "submissionId": "SUB_123456",
  "invoiceId": "MRA_INV_789",
  "status": "Pending|Approved|Rejected",
  "submittedAt": "2025-01-15T10:30:00Z"
}
```

### Appendix B: Invoice Validation Rules

Based on MRA requirements:

1. **Required Fields**:
   - Invoice number (unique, max 50 chars)
   - Invoice date (not future, not older than 1 year)
   - Seller TPIN (8 digits, registered with MRA) - **CRITICAL**
   - Buyer details (name mandatory, TPIN if registered)
   - At least one line item

2. **Tax Calculations**:
   - VAT: 16.5% standard rate
   - PAYE: Not applicable on invoices (handled separately)
   - Withholding tax: As per taxpayer category

3. **Number Formats**:
   - All amounts in MWK
   - 2 decimal places maximum
   - No negative quantities

4. **Date Formats**:
   - ISO 8601: YYYY-MM-DD
   - No time component for invoice date

### Appendix C: Subscription Plan Comparison

| Feature | Monthly | Yearly |
|---------|---------|--------|
| Price | MK150,000/mo | MK950,000/yr |
| Invoices | Unlimited | Unlimited |
| API Calls | 10,000/mo | 120,000/yr |
| Priority Support | ✅ | ✅ |
| Savings | - | Save MK850,000 |

### Appendix D: Implementation Checklist

#### Phase 1: Setup & Configuration
- [ ] Add TPIN field to Tenant and TenantSettings models
- [ ] Create EIS database tables
- [ ] Update subscriptionConfig.js with EIS plans (DONE)
- [ ] Implement encryption utilities
- [ ] Set up environment variables
- [ ] Configure MRA sandbox credentials

#### Phase 2: Core Integration
- [ ] Implement EIS service layer
- [ ] Create API routes (config, submit, status, list)
- [ ] Add subscription access checks
- [ ] Implement invoice transformation
- [ ] Add retry logic and error handling

#### Phase 3: Frontend Development
- [ ] Add TPIN field to /account page
- [ ] Build EIS configuration page
- [ ] Create invoices dashboard
- [ ] Add EIS section to subscription management
- [ ] Implement status badges and filters
- [ ] Add real-time updates

#### Phase 4: Testing & Validation
- [ ] Unit tests for EIS service
- [ ] Integration tests with sandbox
- [ ] End-to-end user flow tests
- [ ] Load testing (100+ concurrent submissions)
- [ ] Security audit

#### Phase 5: MRA Approval
- [ ] Prepare documentation package
- [ ] Complete sandbox testing
- [ ] Submit to MRA
- [ ] Address feedback
- [ ] Receive production credentials

#### Phase 6: Production Deployment
- [ ] Update environment to production
- [ ] Switch API endpoints
- [ ] Configure cron jobs
- [ ] Set up monitoring alerts
- [ ] Train support team
- [ ] Go-live checklist

#### Phase 7: Post-Launch
- [ ] Monitor first 30 days
- [ ] Collect user feedback
- [ ] Optimize performance
- [ ] Plan feature enhancements

### Appendix E: Sample Data

#### Sample Tenant with EIS
```json
{
  "id": "cmf4h273300t8jqsqxys66w2b",
  "name": "Acme Corporation",
  "subdomain": "acme",
  "tpin": "12345678",
  "eisEnabled": true,
  "address": "P.O. Box 123, Blantyre, Malawi",
  "email": "accounts@acme.mw",
  "phone": "+265 1 234 567",
  "subscription": {
    "plan": "eis-standard-yearly",
    "isActive": true,
    "expiresAt": "2026-02-19T00:00:00.000Z"
  }
}
```

#### Sample Invoice
```json
{
  "invoiceNumber": "INV-2025-001",
  "invoiceDate": "2025-01-15",
  "customerName": "XYZ Traders",
  "customerTPIN": "87654321",
  "customerAddress": "P.O. Box 456, Lilongwe",
  "items": [
    {
      "description": "Office Supplies",
      "quantity": 5,
      "unitPrice": 10000,
      "taxRate": 16.5
    }
  ],
  "subtotal": 50000,
  "taxTotal": 8250,
  "total": 58250,
  "currency": "MWK",
  "paymentMethod": "Bank Transfer"
}
```

### Appendix F: POS Test Case Verification (MRA EIS)

This section maps the test cases from **POS_Test_Cases_For_External_Developers_new 23 06 2024.xlsx** to the InsightBooks EIS implementation. Use it to verify that the system will pass MRA/EIS testing when validated against the official test cases.

#### Test Case to Implementation Matrix

| Test Case ID | Category | Title / Objective | Implementation Status | Notes / Location |
|--------------|----------|------------------|------------------------|------------------|
| **TC-INV-001** | Inventory | Insufficient quantity prevention – POS prevents sales when stock is inadequate | ✅ **Supported** | `app/api/sales/route.js`: before creating sale, checks `product.stockLevel` vs `item.quantity`; throws with clear error. |
| **TC-INV-002** | Inventory | (See sheet for full title) | ✅ **Supported** | Same inventory checks; sale creation blocked when stock insufficient. |
| **TC-INV-003**, **TC-INV-004** | Inventory | (Additional inventory scenarios) | ✅ **Supported** | Same validation in sales POST. |
| **TC-TAX-005** | Tax | VAT calculation accuracy – only 16.5% rate should pass | ✅ **Supported** | `lib/eisConfig.js`: `STANDARD_VAT_RATE: 16.5`; tax applied from product/tax config. EIS submission includes item-level `taxRate`; MRA validates. |
| **TC-TAX-006** | Tax | Tourism levy (hospitality) | ⚠️ **Config-dependent** | Supported if tax types and product tax assignment include tourism levy; no EIS-specific logic. |
| **TC-OFF-007**, **TC-OFF-008**, **TC-OFF-009** | Offline | Offline operation, time-based and amount-based thresholds | 📱 **POS/device** | Web app requires network for API; offline behaviour is implemented in POS clients (mobile/desktop). |
| **TC-CONF-010** | Config | Configuration version check – POS detects newer config from server | ⚠️ **Partial** | Tenant/TPIN and EIS config in `/account` and `/eis/config`; terminal-specific config versioning is a POS-client concern. |
| **TC-REC-011** | Receipt | QR code generation on receipts | ✅ **Supported** | Receipt endpoint can include QR; ensure receipt URL is valid (see TC-REC-012). |
| **TC-REC-012** | Receipt | Barcode/URL validation – links to correct transaction URL | ✅ **Supported** | Receipt URL should point to canonical sale/receipt resource; validate in POS or receipt template. |
| **TC-INV-013** | Invoice | Sequential invoice numbering | ✅ **Supported** | Sales: `app/api/sales/route.js` – `SALE-{dateStr}-{seq}`; Invoices: `app/api/invoices/route.js` – `{prefix}-{dateStr}-{seq}`. Both sequential per day/tenant. |
| **TC-INV-014** | Invoice | Invoice number format: `taxpayerId-terminalPosition-transactionDate-receiptSequentialNumber` | ⚠️ **Optional format** | Current format is `SALE-YYYYMMDD-NNN` / `INV-...`. MRA format is supported via `lib/eisConfig.js`: `validateEISInvoiceNumberFormat()`, `EIS_INVOICE_NUMBER_FORMAT_REGEX`. For full compliance, POS or backend can generate numbers as `{tpin}-{terminalPosition}-{YYYYMMDD}-{seq}` (e.g. `12345678-01-20250604-00001`). |
| **TC-RS-015**, **TC-RS-016** | Relief supply | Relief supply VAT removal; VAT 5 certificate validation | ⚠️ **Business logic** | Requires relief-supply and certificate workflow in product/transaction logic; not yet in core EIS path. |
| **TC-UT-017** | Usability | Use of different devices (mobile, desktop, web, printers) | ✅ **Supported** | Web POS consumes same APIs; mobile/desktop POS and printers are client-side. EIS submission works from any device that calls the API. |
| **Device / EIS** | EIS onboarding | Activate terminal – POS successfully onboarded into EIS | ✅ **Supported** | Tenant config in `/account` (TPIN), `/eis/config` (MRA credentials); EIS subscription via billing. No separate “terminal” entity in web; tenant = logical terminal. |
| **Device / EIS** | EIS | Get terminal site products from MRA server | 📋 **MRA API** | MRA may expose product sync; not implemented in this codebase. Products are managed in InsightBooks; EIS submits invoice data. |
| **Device / EIS** | EIS | Make a transaction | ✅ **Supported** | Sales and invoices trigger EIS submission in `app/api/sales/route.js` and `app/api/invoices/route.js` (and quotation convert); `lib/eisService.js` submits to MRA. |
| **Device / EIS** | EIS | VAT registration status; taxpayer registration type | ✅ **Supported** | TPIN and tenant/seller info sent in every EIS payload; VAT treatment follows product/tax setup and MRA validation. |
| **Device / EIS** | EIS | B2B and B2C – B2B online only, no B2B offline | 📱 **POS/device** | Transaction type (B2B vs B2C) can be sent in payload; “online only for B2B” is enforced by POS when offline. Web always online. |
| **Device / EIS** | EIS | Grouped tax rates (A, B, E) | ✅ **Supported** | Product tax assignment and tax types; line-level `taxRate` in EIS payload. |
| **Device / EIS** | EIS | Ping server for server time; use server time for transactions | ⚠️ **Partial** | Transaction dates from server at request time; dedicated “server time” endpoint can be added for POS. |
| **Device / EIS** | EIS | Block terminal | 📋 **Config** | Terminal block state and message are typically managed by MRA/admin; display in POS when block is indicated. |
| **Device / EIS** | EIS | Discounts | ✅ **Supported** | Sales support discounts; totals and line items sent to EIS reflect discounted amounts. |

#### Implementation Checklist for Test Execution

1. **TPIN**: Configure 8-digit TPIN in `/account` (tenant/settings). Validated before EIS submit in `lib/eisConfig.js` (`validateInvoiceData` – seller TPIN required).
2. **EIS credentials**: Configure in `/eis/config`; encryption in `lib/encryption.js`.
3. **Invoice number format (TC-INV-014)**: For strict MRA format, use `validateEISInvoiceNumberFormat(invoiceNumber)` from `lib/eisConfig.js`; generate numbers as `{tpin}-{terminalPosition}-{YYYYMMDD}-{seq}` where applicable.
4. **VAT 16.5%**: Standard rate in `EIS_VALIDATION.STANDARD_VAT_RATE`; ensure product/tax setup uses correct rates so only 16.5% passes where required.
5. **Stock check**: Sales API rejects with clear message when quantity exceeds `stockLevel` (TC-INV-001).
6. **Receipts**: Ensure receipt route and templates use a stable, valid URL for the transaction (TC-REC-012).

No existing EIS behaviour in the guide or codebase has been removed or altered beyond adding validation and this verification section.

---

## Conclusion

This implementation guide provides a comprehensive roadmap for integrating MRA EIS into InsightBooks. Key success factors:

1. **Follow MRA specifications exactly** - Use the official API documentation
2. **Maintain separation** - EIS plans are distinct from regular subscriptions
3. **Ensure compliance** - Implement all security and audit requirements
4. **TPIN Management** - Configure TPIN in `/account` for each tenant
5. **Test thoroughly** - Use sandbox extensively before production
6. **Monitor continuously** - Set up alerts for all critical metrics

For questions or clarifications, refer to:
- MRA EIS Technical Documentation (official): https://eis-api.mra.mw/swagger/index.html
- MRA EIS API Guide: https://dev-eis-api.mra.mw/docs/
- InsightBooks internal documentation
- This implementation guide (latest version)

**Document Version**: 2.0  
**Last Updated**: 2026-03-02  
**Next Review**: 2026-06-02

---

## Revision History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-01-15 | Initial draft | InsightBooks Team |
| 2.0 | 2026-03-02 | Enhanced with codebase alignment, TPIN management, subscription integration | InsightBooks Team |
