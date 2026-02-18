# Invoicing & POS Features

## Overview

This document describes the newly implemented features for Invoicing and POS:

1. **Titles and Order Numbers**
2. **Invoice Attachments**
3. **Tax Lines Display**

## 1. Titles and Order Numbers

### Schema Changes

Added fields to Invoice, Quotation, and Sale models:

**Invoice Model:**
- `title String?` - Optional title for the invoice
- `orderNumber String?` - Optional order number/reference

**Quotation Model:**
- `orderNumber String?` - Optional order number/reference (title already existed)

**Sale Model:**
- `title String?` - Optional title for the sale/receipt
- `orderNumber String?` - Optional order number/reference

### API Changes

#### Invoice API (`/api/invoices`)
- **POST**: Accepts `title` and `orderNumber` in request body
- **PUT**: Supports updating `title` and `orderNumber`

#### Quotation API (`/api/quotations`)
- **POST**: Accepts `orderNumber` in request body (title already supported)
- **PUT**: Supports updating `orderNumber`

#### Sale API (`/api/sales`)
- **POST**: Accepts `title` and `orderNumber` in request body

### Usage Examples

**Create Invoice with Title and Order Number:**
```json
{
  "clientId": "client-123",
  "title": "Monthly Service Invoice",
  "orderNumber": "ORD-2024-001",
  "items": [...],
  ...
}
```

**Create Quotation with Order Number:**
```json
{
  "clientId": "client-123",
  "title": "Project Proposal",
  "orderNumber": "PO-2024-001",
  "items": [...],
  ...
}
```

**Create Sale with Title and Order Number:**
```json
{
  "title": "Customer Order",
  "orderNumber": "SO-2024-001",
  "items": [...],
  ...
}
```

## 2. Invoice Attachments

### Schema Changes

Added `InvoiceAttachment` model:

```prisma
model InvoiceAttachment {
  id          String   @id @default(cuid())
  invoiceId   String
  fileName    String
  filePath    String
  fileSize    Int
  mimeType    String
  uploadedAt  DateTime @default(now())
  uploadedById String
  tenantId    String
  invoice     Invoice  @relation(...)
  uploadedBy  User     @relation(...)
  tenant      Tenant   @relation(...)
}
```

### API Endpoints

#### Get Attachments
```
GET /api/invoices/[id]/attachments
```

Returns list of all attachments for an invoice.

**Response:**
```json
[
  {
    "id": "att-123",
    "fileName": "contract.pdf",
    "fileSize": 102400,
    "mimeType": "application/pdf",
    "uploadedAt": "2024-01-15T10:00:00Z",
    "uploadedBy": {
      "id": "user-123",
      "name": "John Doe"
    }
  }
]
```

#### Upload Attachment
```
POST /api/invoices/[id]/attachments
Content-Type: multipart/form-data

Form Data:
- file: [File]
```

**Response:**
```json
{
  "message": "Attachment uploaded successfully",
  "attachment": {
    "id": "att-123",
    "fileName": "contract.pdf",
    ...
  }
}
```

**File Limits:**
- Maximum file size: 10MB
- Files are stored in `uploads/invoices/[invoiceId]/` directory

#### Download Attachment
```
GET /api/invoices/[id]/attachments/[attachmentId]
```

Returns the file with appropriate headers for download.

#### Delete Attachment
```
DELETE /api/invoices/[id]/attachments/[attachmentId]
```

Deletes both the file and the database record.

### File Storage

- Files are stored in: `uploads/invoices/[invoiceId]/[timestamp]-[filename]`
- Files are automatically deleted when invoice is deleted (CASCADE)
- File paths are stored relative to project root

## 3. Tax Lines Display

### Current Implementation

Tax information is already stored in the database:

**Invoices:**
- `Invoice.taxAmount` - Total tax amount
- `InvoiceItem.taxRate` - Tax rate per item

**Quotations:**
- `Quotation.taxAmount` - Total tax amount
- `QuotationItem.taxRate` - Tax rate per item

**Sales:**
- `Sale.totalTaxAmount` - Total tax amount
- `SaleItem.taxRate` - Tax rate per item
- `SaleItemTax` - Detailed tax breakdown (multiple taxes per item)

### Display Requirements

Tax lines should be displayed on:
1. **Invoice PDFs** - Show tax breakdown in totals section
2. **Quotation PDFs** - Show tax breakdown in totals section
3. **POS Receipts** - Show tax breakdown in totals section

### Tax Line Format

For invoices and quotations with single tax rate:
```
Subtotal:          $1,000.00
Tax (16.5%):       $165.00
Total:             $1,165.00
```

For sales with multiple taxes (SaleItemTax):
```
Subtotal:          $1,000.00
VAT (16.5%):       $165.00
Service Tax (5%):  $50.00
Total Tax:         $215.00
Total:             $1,215.00
```

## Database Migration

### Required Migration

To apply these changes, run:

```bash
npx prisma migrate dev --name add_invoicing_pos_features
```

Or for production:
```bash
npx prisma migrate deploy
```

### Schema Changes Summary

1. **Invoice Model**: Added `title String?` and `orderNumber String?`
2. **Quotation Model**: Added `orderNumber String?`
3. **Sale Model**: Added `title String?` and `orderNumber String?`
4. **InvoiceAttachment Model**: New model for invoice file attachments
5. **Relations**: Added relations to User and Tenant models

## Frontend Integration

### Invoice Form

Add fields to invoice creation/edit form:
```jsx
<input
  type="text"
  placeholder="Invoice Title (optional)"
  value={formData.title}
  onChange={(e) => setFormData({...formData, title: e.target.value})}
/>

<input
  type="text"
  placeholder="Order Number (optional)"
  value={formData.orderNumber}
  onChange={(e) => setFormData({...formData, orderNumber: e.target.value})}
/>
```

### Attachment Upload Component

```jsx
const handleFileUpload = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(`/api/invoices/${invoiceId}/attachments`, {
    method: 'POST',
    body: formData
  });
  
  const result = await response.json();
  // Handle result
};
```

### Display Tax Lines

Update PDF generation to include tax breakdown:
- Group items by tax rate
- Calculate tax per group
- Display in totals section

## Files Modified/Created

### Created Files
- `app/api/invoices/[id]/attachments/route.js` - Attachment management endpoints
- `app/api/invoices/[id]/attachments/[attachmentId]/route.js` - Individual attachment operations

### Modified Files
- `prisma/schema.prisma` - Added fields and InvoiceAttachment model
- `app/api/invoices/route.js` - Added title and orderNumber support
- `app/api/quotations/route.js` - Added orderNumber support
- `app/api/sales/route.js` - Added title and orderNumber support

## Testing

After migration, test the following:

1. Create invoice with title and order number
2. Create quotation with order number
3. Create sale with title and order number
4. Upload attachment to invoice
5. Download attachment from invoice
6. Delete attachment from invoice
7. Verify tax lines display correctly on PDFs and receipts

## Notes

- All new fields are optional to maintain backward compatibility
- Attachments are stored in the filesystem, not in the database
- File uploads are limited to 10MB per file
- Tax lines should be grouped and displayed clearly on all documents
- Order numbers can be used for tracking external references (PO numbers, etc.)
