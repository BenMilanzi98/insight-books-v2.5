# Web `/invoice` ↔ Android invoice feature parity

This document maps the main web invoicing page behavior to the Flutter implementation.

| Web surface / API | Android location |
|-------------------|-------------------|
| List, search, tabs (All, Drafts, Pending, Paid, Overdue), sort, pagination, date + client filters, stats | `invoice_list_screen.dart`, `invoice_provider.dart` |
| CSV export | `invoice_repository.exportInvoices`, `invoice_provider.exportCsv`, list AppBar |
| Create / edit invoice (Draft vs Send/Pending), line items, tax, global discount, terms, notes, template | `create_invoice_screen.dart`, `invoice_repository` create/update |
| Invoice details, summary, payment history | `invoice_details_screen.dart`, `invoice_details_provider.dart` |
| Edit (Draft only in web row actions; API allows Draft/Pending) | Details menu + `/invoice/:id/edit` → `CreateInvoiceScreen(invoiceId:)` |
| Send email (`POST /api/invoices/:id/send` JSON: message, templateId, otherEmails) | `invoice_repository.sendInvoice`, send dialog on details |
| Official PDF (`GET /api/invoices/:id/download/pdf?templateId=`) | `invoice_repository.downloadInvoicePdf`, preview + share |
| Partial payment (`POST /api/invoices/partial-payment`) | `invoice_repository.addPartialPayment`, bottom sheet |
| Mark paid (`POST /api/invoices/:id/mark-paid`) | `invoice_repository.markAsPaid` |
| Void (`POST /api/invoices/void`) | `invoice_repository.voidInvoice` |
| Refund (`POST /api/invoices/refund`) | `invoice_repository.refundInvoice` |
| Delete | `invoice_repository.deleteInvoice` |
| Payment receipts (`POST /api/payments/receipt` → JSON receipt) | `invoice_repository.fetchReceiptPdfBytes` + `invoice_receipt_pdf.dart` (client PDF) |
| Permissions (view/create/update/delete/export/send) | `invoice_provider.loadPermissions`, `permissions_provider.dart` |

Validation parity is enforced in Android UI to mirror `InvoiceModal`, `VoidInvoiceModal`, `RefundInvoiceModal`, `PartialPaymentModal`, and `SendInvoiceModal` where applicable.
