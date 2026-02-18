# Client Management Features

## Overview

This document describes the newly implemented client management features:

1. **Multiple Email Addresses per Client**
2. **Balance Reminder Templates**
3. **Client Account Summary/Trading History Download**
4. **Tenant Email for Sending**

## 1. Multiple Email Addresses per Client

### Schema Changes

Added `additionalEmails` field to `Client` model:
```prisma
model Client {
  // ... existing fields
  email         String?
  additionalEmails String[]  @default([]) // Multiple email addresses
  // ... rest of fields
}
```

### API Changes

- **GET `/api/clients`**: Now includes `additionalEmails` in response
- **POST `/api/clients`**: Accepts `additionalEmails` array in request body
- **PUT `/api/clients/[id]`**: Supports updating `additionalEmails`
- **GET `/api/clients/[id]`**: Returns `additionalEmails` in response

### Usage

When creating/updating a client:
```json
{
  "name": "Client Name",
  "email": "primary@example.com",
  "additionalEmails": ["secondary@example.com", "billing@example.com"]
}
```

### Email Sending

When sending invoices or emails to clients, the system now:
- Sends to primary email (`email` field)
- Sends to all additional emails (`additionalEmails` array)
- All recipients receive the same email

## 2. Balance Reminder Templates

### Features

- Customizable email templates for balance reminders
- Template variables for dynamic content
- Default template if no custom template is set

### Template Variables

Available variables in templates:
- `{{clientName}}` - Client's name
- `{{companyName}}` - Tenant/company name
- `{{totalBalance}}` - Total outstanding balance (formatted currency)
- `{{invoiceCount}}` - Number of outstanding invoices
- `{{oldestInvoiceDate}}` - Date of oldest outstanding invoice
- `{{invoiceList}}` - Formatted list of outstanding invoices

### API Endpoints

#### Get Template
```
GET /api/clients/balance-reminder-template
```

Returns current template (custom or default).

#### Update Template
```
POST /api/clients/balance-reminder-template
Body: {
  "subject": "Custom Subject - {{companyName}}",
  "body": "Custom email body with {{variables}}"
}
```

#### Send Balance Reminder
```
POST /api/clients/[id]/balance-reminder
```

Sends balance reminder to client using the template.

### Default Template

Subject: `Outstanding Balance Reminder - {{companyName}}`

Body includes:
- Greeting with client name
- Outstanding balance summary
- List of outstanding invoices
- Payment instructions

## 3. Client Account Summary/Trading History

### Features

- Complete transaction history (invoices, sales, quotations, payments)
- Outstanding balance summary
- Export in multiple formats (JSON, CSV)
- Date range filtering

### API Endpoint

```
GET /api/clients/[id]/account-summary?format=json&startDate=2024-01-01&endDate=2024-12-31
```

### Query Parameters

- `format` (optional): `json` (default) or `csv`
- `startDate` (optional): Start date for filtering (YYYY-MM-DD)
- `endDate` (optional): End date for filtering (YYYY-MM-DD)

### Response Structure

```json
{
  "client": {
    "id": "...",
    "name": "Client Name",
    "email": "...",
    "phone": "...",
    "address": "..."
  },
  "period": {
    "startDate": "2024-01-01",
    "endDate": "2024-12-31"
  },
  "totals": {
    "totalInvoiced": 10000,
    "totalPaid": 8000,
    "totalOutstanding": 2000,
    "totalSales": 5000,
    "totalQuoted": 3000,
    "netTotal": 15000
  },
  "outstanding": {
    "totalBalance": 2000,
    "invoiceCount": 2,
    "invoices": [...]
  },
  "transactions": [
    {
      "type": "Invoice",
      "date": "2024-01-15",
      "reference": "INV-001",
      "description": "Invoice #INV-001",
      "debit": 5000,
      "credit": 0,
      "balance": 2000,
      "status": "Partially Paid",
      "dueDate": "2024-02-15"
    },
    // ... more transactions
  ],
  "generatedAt": "2024-12-31T12:00:00.000Z"
}
```

### Transaction Types

- **Invoice**: Client invoices
- **Payment**: Payments against invoices/sales
- **Sale**: POS sales transactions
- **Quotation**: Quotations sent to client

## 4. Tenant Email for Sending

### Changes

All email sending now uses the tenant's business email instead of system email:

1. **Invoice Sending** (`/api/invoices/[id]/send`)
   - Uses `tenant.settings.businessEmail` as sender
   - Falls back to `process.env.EMAIL_FROM` if not set
   - Sets `replyTo` to tenant email

2. **Client Email Sending** (`/api/clients/send-email`)
   - Uses `tenant.settings.businessEmail` as sender
   - Falls back to `process.env.EMAIL_FROM` if not set

3. **Balance Reminders** (`/api/clients/[id]/balance-reminder`)
   - Uses `tenant.settings.businessEmail` as sender
   - Falls back to `process.env.EMAIL_FROM` if not set

### Email Format

All emails are sent from:
```
"Company Name" <business@tenant.com>
```

With reply-to set to the tenant's business email.

## Database Migration

### Required Migration

To apply these changes, run:

```bash
npx prisma migrate dev --name add_client_management_features
```

Or for production:
```bash
npx prisma migrate deploy
```

### Schema Changes

1. **Client Model**: Added `additionalEmails String[] @default([])`
2. **TenantSettings Model**: Added `balanceReminderSubject String?` and `balanceReminderBody String?`

## Usage Examples

### Send Balance Reminder

```javascript
// POST /api/clients/[clientId]/balance-reminder
const response = await fetch(`/api/clients/${clientId}/balance-reminder`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
});
```

### Download Account Summary

```javascript
// JSON format
const jsonResponse = await fetch(`/api/clients/${clientId}/account-summary?format=json`);

// CSV format
const csvResponse = await fetch(`/api/clients/${clientId}/account-summary?format=csv`);
const blob = await csvResponse.blob();
// Download the blob as a file
```

### Update Balance Reminder Template

```javascript
// POST /api/clients/balance-reminder-template
await fetch('/api/clients/balance-reminder-template', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    subject: 'Payment Reminder - {{companyName}}',
    body: 'Dear {{clientName}},\n\nYou have an outstanding balance of {{totalBalance}}...'
  })
});
```

### Create Client with Multiple Emails

```javascript
// POST /api/clients
await fetch('/api/clients', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Client Name',
    email: 'primary@example.com',
    additionalEmails: ['billing@example.com', 'accounts@example.com']
  })
});
```

## Files Modified/Created

### Created Files
- `lib/balanceReminderService.js` - Balance reminder service
- `app/api/clients/[id]/balance-reminder/route.js` - Send balance reminder endpoint
- `app/api/clients/[id]/account-summary/route.js` - Account summary endpoint
- `app/api/clients/balance-reminder-template/route.js` - Template management endpoint

### Modified Files
- `prisma/schema.prisma` - Added `additionalEmails` to Client, `balanceReminderSubject` and `balanceReminderBody` to TenantSettings
- `app/api/clients/route.js` - Added `additionalEmails` support
- `app/api/clients/[id]/route.js` - Added `additionalEmails` support
- `app/api/invoices/[id]/send/route.js` - Use tenant email, support multiple client emails
- `app/api/clients/send-email/route.js` - Use tenant email

## Testing

After migration, test the following:

1. Create a client with multiple emails
2. Send an invoice - verify all emails receive it
3. Send a balance reminder - verify template is used
4. Download account summary in JSON and CSV formats
5. Update balance reminder template
6. Verify emails are sent from tenant's business email

## Notes

- The `additionalEmails` field defaults to an empty array, so existing clients are not affected
- Balance reminder templates support all standard template variables
- Account summary includes all transaction types (invoices, sales, quotations, payments)
- CSV export includes all transaction details in a tabular format
- All email sending respects tenant email settings
