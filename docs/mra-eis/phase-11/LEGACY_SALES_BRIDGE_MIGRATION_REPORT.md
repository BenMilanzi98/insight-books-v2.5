# Legacy Migration Report

Sales, invoices, quotation-convert no longer call `eisService.submitInvoice`. Historical EISInvoice rows preserved. No historical resubmission.

---
*Phase 11 implementation. Local sales eligibility + bridge only. No MRA Sale submission, fiscal number, QR, or “MRA validated” receipt. Bridge creates no Journal/Stock Movement. Customer payments are not Sales. Draft/Quote/Proforma excluded.*
