# Document Appearance Templates — Design Spec

**Date:** 2026-08-21  
**Status:** Approved  
**Scope:** Invoice + Quotation shared layouts, tenant default + per-document override + bulk apply, colour/logo position, live preview, multi-page print/PDF fix

---

## 1. Goals

1. Ship **10 professional shared layouts** used by both invoices and quotations (document label differs: Invoice vs Quotation).
2. Tenants can set a **default** template for all new documents.
3. Tenants can **override** appearance on a single invoice/quotation.
4. Tenants can **bulk-apply** a template to selected documents on list pages.
5. Support **primary colour** customization and **logo position** (`left | center | right`).
6. Every layout must have a **live preview** (thumbnail + full preview) that matches download/print/PDF.
7. Fix pagination so totals/summary blocks are **not sliced** across pages.

Non-goals for this release: free-form logo drag, per-line-item theming, separate layout catalogs per document type, full visual template builder.

---

## 2. Decisions (locked)

| Topic | Choice |
|-------|--------|
| Apply model | Tenant default + per-document override + bulk apply to selected |
| Logo positions | Three: top-left, top-center, top-right |
| Layout sharing | Same 10 layouts for invoices and quotations |
| Architecture | Extend existing `InvoiceTemplate` + add FKs on documents |
| PDF strategy | Prefer server jsPDF; add CSS `break-inside: avoid` on totals; stop mid-box html2canvas slicing for multi-page |

---

## 3. Data model

### 3.1 Extend `InvoiceTemplate.content` JSON

```json
{
  "layoutId": "classic",
  "style": "classic",
  "primaryColor": "#1d4ed8",
  "logoPosition": "left",
  "showLogo": true,
  "showFooter": true
}
```

- `layoutId`: one of the 10 registry keys (source of truth).
- `style`: kept for backward compatibility; map legacy `standard|professional|minimal|bold|classic|modern|compact` → nearest `layoutId`.
- Existing Classic/Modern/Compact/Bold continue to work via mapping.

### 3.2 Per-document override

- `Invoice.templateId String?` → FK `InvoiceTemplate`
- `Quotation.templateId String?` → FK `InvoiceTemplate`
- Null = use tenant default (`InvoiceTemplate` where `isDefault = true`).

### 3.3 Resolution order

1. Document `templateId` (if set and belongs to tenant)  
2. Else tenant default `InvoiceTemplate`  
3. Else built-in Classic + tenant `primaryColor` / `logoUrl`

### 3.4 Migration

Additive Prisma migration: nullable FKs + indexes. No data loss. Seed/migrate existing `content.style` values into `layoutId` on read if missing.

---

## 4. Layout registry (10)

Shared module: `lib/documentTemplates/registry.js`

| layoutId | Name | Visual brief |
|----------|------|----------------|
| `classic` | Classic | Clean white, thin rules, traditional |
| `modern` | Modern | Strong primary header band |
| `bold-bar` | Bold Bar | Full-width accent top bar, large title |
| `minimal` | Minimal | Whitespace-heavy, subtle lines |
| `compact` | Compact | Dense table, tighter margins |
| `editorial` | Editorial | Strong title hierarchy, asymmetric header |
| `band-header` | Band Header | Two-tone brand + slate header |
| `split-brand` | Split Brand | Logo/company left; meta panel right |
| `soft-card` | Soft Card | Rounded cards for parties + totals |
| `ledger` | Ledger | Grid-forward, tabular amounts |

Each registry entry exposes: `id`, `name`, `description`, `previewAccent`, `compatStyles[]` (legacy aliases).

---

## 5. Preview (required)

### 5.1 Thumbnail grid

On invoice/quotation appearance UI and bulk-apply dialog:

- Show all **10 layouts** as selectable cards.
- Each card: miniature static chrome (header/table/totals silhouette) tinted with current `primaryColor`, plus layout name.
- Selected card has clear focus ring / check state.

### 5.2 Live full preview

- Side or modal **live preview** using the same React renderer as print (`DocumentTemplatePreview`), with sample or current document data.
- Changing layout / colour / logo position updates preview immediately (no save required for preview).
- Preview shows correct document label (Invoice vs Quotation).

### 5.3 Single render contract

One layout implementation drives:

1. React preview (`DocumentTemplatePreview` — used by invoice & quotation UIs)  
2. Puppeteer HTML (`server-pdf-html.js`)  
3. jsPDF (`server-pdf-jspdf.js`)

No layout may ship UI-only without PDF parity in the same release slice.

---

## 6. UI surfaces

### 6.1 Invoice list (`/invoice`) & Quotation list (`/quotations`)

- Appearance controls: default template indicator.
- Multi-select → **Apply template**:
  - Layout grid with preview
  - Colour + logo position
  - Apply to selected documents
  - Optional: “Also set as tenant default”
- Download/print/email resolve template per document.

### 6.2 Create/edit modals

- “Document appearance” panel with thumbnail grid + live preview + colour + logo position.
- Saving the document stores `templateId` (and optional content snapshot only if needed — prefer FK to tenant template row, or create a one-off template row named for the document).
- Prefer: selecting appearance either (a) attaches an existing tenant template id, or (b) creates/updates a tenant template and links it — avoid silent mutation of the default unless “Set as default” is checked.

**Apply semantics in modal**

- Default: save appearance **on this document only**.
- Optional checkbox: **Set as default for all new invoices/quotations**.

### 6.3 Customization page

- Keep `/customization?tab=invoices` as catalog of named templates + set default.
- Upgrade picker to the 10-layout grid with live preview.

---

## 7. APIs

- Extend `GET/POST/PUT /api/invoice/templates` to accept/return `layoutId`, `logoPosition`, `primaryColor`.
- `PATCH /api/invoices/bulk-template` — `{ invoiceIds[], templateId?, appearance?, setAsDefault? }`
- `PATCH /api/quotations/bulk-template` — same shape
- Download/send routes already accept `templateId`; prefer document’s stored id when query omitted.

---

## 8. Page-break / cut-content fix

**Problem:** Client html2canvas stamps one tall image onto A4 pages, slicing mid-element (totals card). Print CSS lacks `break-inside: avoid`.

**Fix:**

1. Totals, summary, payment notes, thank-you, footer: `break-inside: avoid; page-break-inside: avoid`.
2. Prefer server `/download/pdf` (jsPDF `ensurePageSpace`) for multi-page downloads from list/modal.
3. If client capture remains for some flows: detect page boundaries and avoid splitting protected regions, or fall back to server PDF when height > one page.

Success criterion: for a long line-item document, the totals card appears wholly on one page (never half on page 1 and half on page 2).

---

## 9. Out of scope

- Drag-position logo
- Separate 10 layouts only for quotations
- Per-item colour rules
- Rewriting historical PDFs already emailed (only future renders)

---

## 10. Acceptance criteria

1. User can browse **10 layouts with thumbnail + live preview** on invoice and quotation flows.  
2. User can set tenant default; new documents use it.  
3. User can override one document without changing others.  
4. User can bulk-apply to selected invoices and quotations.  
5. Colour and logo L/C/R apply in preview and PDF.  
6. Long documents do not split the totals box across pages.  
7. Legacy templates still open (mapped to new layout ids).

---

## 11. Implementation notes

- Primary files today: `InvoiceTemplatePreview.js`, `QuotationTemplatePreview.js`, `lib/server-pdf-jspdf.js`, `lib/server-pdf-html.js`, `lib/invoiceCapture.js`, `app/customization/page.js`, `app/invoice/page.js`, `app/quotations/page.js`, `components/InvoiceModal.js`, `QuotationModal.js`.
- Prefer extracting shared `DocumentTemplatePreview` to avoid invoice/quote drift.
- Tests: registry mapping, resolveTemplate(document|tenant), page-break CSS presence / jsPDF totals keep-together smoke where feasible.
