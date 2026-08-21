# Document Appearance Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 10 shared professional invoice/quotation layouts with live preview, tenant default + per-document override + bulk apply, colour and logo L/C/R, and fix multi-page totals splitting.

**Architecture:** Extend `InvoiceTemplate.content` with `layoutId` + `logoPosition`; add nullable `templateId` on `Invoice` and `Quotation`; single shared React/HTML/jsPDF render contract via a layout registry; list/modals get thumbnail grid + live preview; downloads prefer server jsPDF and CSS `break-inside: avoid`.

**Tech Stack:** Next.js App Router, Prisma/Postgres, existing `InvoiceTemplate` APIs, `InvoiceTemplatePreview` / `QuotationTemplatePreview`, `lib/server-pdf-jspdf.js`, `lib/server-pdf-html.js`, Vitest.

## Global Constraints

- Same 10 layouts for invoices and quotations (label text differs only).
- Logo positions: `left | center | right` only.
- Apply model: tenant default + per-document override + bulk apply.
- Every layout must have thumbnail + live preview before merge.
- Preview, HTML PDF, and jsPDF must stay visually aligned per layout.
- Do not silently mutate tenant default unless user opts in.
- Additive migrations only; map legacy `style` values to `layoutId`.

**Spec:** `docs/superpowers/specs/2026-08-21-document-appearance-templates-design.md`

## File map

| File | Responsibility |
|------|----------------|
| `lib/documentTemplates/registry.js` | 10 layout definitions + legacy style mapping |
| `lib/documentTemplates/resolveDocumentTemplate.js` | Resolve template for a document/tenant |
| `components/documentTemplates/DocumentTemplatePreview.jsx` | Shared live renderer for all layouts |
| `components/documentTemplates/LayoutPicker.jsx` | Thumbnail grid + colour + logo position + live preview |
| `components/documentTemplates/BulkApplyTemplateDialog.jsx` | Multi-select apply UI |
| `prisma/schema.prisma` + migration | `Invoice.templateId`, `Quotation.templateId` |
| `app/api/invoice/templates/*` | Accept/return new content fields |
| `app/api/invoices/bulk-template/route.js` | Bulk apply invoices |
| `app/api/quotations/bulk-template/route.js` | Bulk apply quotations |
| `lib/server-pdf-jspdf.js` / `server-pdf-html.js` | PDF parity + keep-together |
| `lib/invoiceCapture.js` | Avoid mid-box slicing / prefer server PDF |
| `app/invoice/page.js`, `app/quotations/page.js` | List bulk apply + download resolution |
| `components/InvoiceModal.js`, `QuotationModal.js` | Per-document appearance |
| `app/customization/page.js` | 10-layout catalog + default |
| `test/documentTemplates*.test.js` | Registry + resolve + mapping tests |

---

### Task 1: Layout registry + legacy mapping

**Files:**
- Create: `lib/documentTemplates/registry.js`
- Create: `test/documentTemplates.registry.test.js`

**Interfaces:**
- Produces: `DOCUMENT_LAYOUTS`, `getLayout(layoutId)`, `normalizeLayoutId(styleOrLayoutId)`, `LEGACY_STYLE_TO_LAYOUT`

- [ ] **Step 1: Write failing tests**

```js
import { describe, expect, it } from 'vitest';
import { DOCUMENT_LAYOUTS, normalizeLayoutId, getLayout } from '../lib/documentTemplates/registry.js';

describe('document template registry', () => {
  it('exposes exactly 10 layouts', () => {
    expect(DOCUMENT_LAYOUTS).toHaveLength(10);
  });

  it('maps legacy styles to layout ids', () => {
    expect(normalizeLayoutId('standard')).toBe('classic');
    expect(normalizeLayoutId('professional')).toBe('modern');
    expect(normalizeLayoutId('minimal')).toBe('minimal');
    expect(normalizeLayoutId('bold')).toBe('bold-bar');
    expect(normalizeLayoutId('classic')).toBe('classic');
  });

  it('returns layout metadata for known ids', () => {
    expect(getLayout('split-brand').name).toBe('Split Brand');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx vitest run test/documentTemplates.registry.test.js`

- [ ] **Step 3: Implement registry** with ids: `classic`, `modern`, `bold-bar`, `minimal`, `compact`, `editorial`, `band-header`, `split-brand`, `soft-card`, `ledger`. Each: `{ id, name, description, previewAccent, compatStyles }`.

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit** `feat(templates): add document layout registry`

---

### Task 2: Schema — per-document templateId

**Files:**
- Modify: `prisma/schema.prisma` (`Invoice`, `Quotation`, `InvoiceTemplate` relations)
- Create: `prisma/migrations/20260821140000_document_template_fk/migration.sql`

**Interfaces:**
- Produces: `Invoice.templateId`, `Quotation.templateId` nullable FKs

- [ ] **Step 1: Add fields**

```prisma
// on Invoice
templateId String?
template   InvoiceTemplate? @relation("InvoiceDocumentTemplate", fields: [templateId], references: [id], onDelete: SetNull)

// on Quotation
templateId String?
template   InvoiceTemplate? @relation("QuotationDocumentTemplate", fields: [templateId], references: [id], onDelete: SetNull)

// on InvoiceTemplate
invoices    Invoice[]    @relation("InvoiceDocumentTemplate")
quotations  Quotation[]  @relation("QuotationDocumentTemplate")
```

- [ ] **Step 2: Migration SQL**

```sql
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "templateId" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "templateId" TEXT;
CREATE INDEX IF NOT EXISTS "Invoice_templateId_idx" ON "Invoice"("templateId");
CREATE INDEX IF NOT EXISTS "Quotation_templateId_idx" ON "Quotation"("templateId");
-- FKs if not present
```

- [ ] **Step 3: `npx prisma generate`**

- [ ] **Step 4: Commit** `feat(templates): add per-document templateId FKs`

---

### Task 3: Resolve template helper

**Files:**
- Create: `lib/documentTemplates/resolveDocumentTemplate.js`
- Create: `test/documentTemplates.resolve.test.js`

**Interfaces:**
- Consumes: registry `normalizeLayoutId`
- Produces: `async resolveDocumentTemplate(db, { tenantId, templateId })` → `{ template, layoutId, primaryColor, logoPosition, showLogo, showFooter }`

- [ ] **Step 1: Failing tests** for default fallback, explicit id, legacy style normalization, missing id → default.

- [ ] **Step 2: Implement** load by id (tenant-scoped) else `isDefault`, parse `content` JSON safely, apply `normalizeLayoutId`.

- [ ] **Step 3: Tests pass + commit** `feat(templates): resolve document appearance`

---

### Task 4: Shared DocumentTemplatePreview (classic + modern first)

**Files:**
- Create: `components/documentTemplates/DocumentTemplatePreview.jsx`
- Modify: `components/InvoiceTemplatePreview.js` (thin wrapper)
- Modify: `components/QuotationTemplatePreview.js` (thin wrapper)

**Interfaces:**
- Consumes: registry
- Produces: `<DocumentTemplatePreview documentType="invoice"|"quotation" data branding templateContent isPrint />`

- [ ] **Step 1: Extract shared chrome** from current standard + professional renderers into `DocumentTemplatePreview` switching on `layoutId`.
- [ ] **Step 2: Wire invoice/quotation wrappers** so existing imports keep working.
- [ ] **Step 3: Add print CSS** on totals/summary/footer:

```css
.ib-doc-keep {
  break-inside: avoid;
  page-break-inside: avoid;
}
```

- [ ] **Step 4: Manual smoke** — open invoice preview standard/modern.
- [ ] **Step 5: Commit** `feat(templates): shared document preview shell`

---

### Task 5: Implement remaining 8 layouts in React preview

**Files:**
- Modify: `components/documentTemplates/DocumentTemplatePreview.jsx`

- [ ] **Step 1: Implement** `bold-bar`, `minimal`, `compact`, `editorial`, `band-header`, `split-brand`, `soft-card`, `ledger` as distinct header/table/totals chrome using `primaryColor` + `logoPosition`.
- [ ] **Step 2: Ensure logo** renders left/center/right for each.
- [ ] **Step 3: Visual check** all 10 with sample data.
- [ ] **Step 4: Commit** `feat(templates): add ten document layout previews`

---

### Task 6: LayoutPicker UI (thumbnails + live preview)

**Files:**
- Create: `components/documentTemplates/LayoutPicker.jsx`

**Interfaces:**
- Produces: `<LayoutPicker value={{ layoutId, primaryColor, logoPosition, showLogo }} onChange documentType sampleData branding />`

- [ ] **Step 1: Build thumbnail grid** — 10 cards; silhouette tinted with `primaryColor`; selected state.
- [ ] **Step 2: Controls** — colour input, logo position segmented control L/C/R, show logo toggle.
- [ ] **Step 3: Live preview panel** embedding `DocumentTemplatePreview` with current value.
- [ ] **Step 4: Commit** `feat(templates): layout picker with live preview`

---

### Task 7: Template API content shape

**Files:**
- Modify: `app/api/invoice/templates/route.js`
- Modify: `app/api/invoice/templates/[id]/route.js`

- [ ] **Step 1: On write**, normalize `content.layoutId` via `normalizeLayoutId`, persist `logoPosition`, `primaryColor`, `showLogo`, `showFooter`.
- [ ] **Step 2: On read**, ensure `layoutId` present (derive from `style` if needed).
- [ ] **Step 3: Commit** `feat(templates): persist layoutId and logoPosition`

---

### Task 8: Invoice & Quotation modal appearance

**Files:**
- Modify: `components/InvoiceModal.js`
- Modify: `components/QuotationModal.js` (or equivalent)

- [ ] **Step 1: Replace** old Classic/Modern/Compact/Bold select with `LayoutPicker`.
- [ ] **Step 2: On save**, set document `templateId` (create/link tenant template row if needed) **without** changing default unless checkbox “Set as default for all new documents”.
- [ ] **Step 3: Remove** silent `applyTemplateAppearance` PUT that mutates shared default on every colour change (replace with explicit save).
- [ ] **Step 4: Commit** `feat(templates): per-document appearance in modals`

---

### Task 9: Bulk apply APIs + list UI

**Files:**
- Create: `app/api/invoices/bulk-template/route.js`
- Create: `app/api/quotations/bulk-template/route.js`
- Create: `components/documentTemplates/BulkApplyTemplateDialog.jsx`
- Modify: `app/invoice/page.js`
- Modify: `app/quotations/page.js`

- [ ] **Step 1: API** validates tenant ownership, updates `templateId` for ids[], optional `setAsDefault`.
- [ ] **Step 2: Dialog** uses `LayoutPicker` + Apply.
- [ ] **Step 3: List pages** — selection + “Apply template” action.
- [ ] **Step 4: Commit** `feat(templates): bulk apply document templates`

---

### Task 10: PDF / HTML parity + page-break fix

**Files:**
- Modify: `lib/server-pdf-jspdf.js`
- Modify: `lib/server-pdf-html.js`
- Modify: `lib/invoiceCapture.js`
- Modify: download routes to prefer document `templateId`

- [ ] **Step 1: jsPDF** — branch on `layoutId` (at minimum map new layouts to closest existing draw path in this task; full chrome parity can extend modern/classic/minimal/bold families first, then distinct headers).
- [ ] **Step 2: HTML** — same `layoutId` classes + `break-inside: avoid` on totals.
- [ ] **Step 3: Capture** — if document height > page, use server PDF download instead of canvas slice; or slice only at safe Y gaps.
- [ ] **Step 4: Manual test** — long invoice PDF: totals box not split (matches screenshot bug).
- [ ] **Step 5: Commit** `fix(templates): keep totals together across pages`

---

### Task 11: Customization page upgrade

**Files:**
- Modify: `app/customization/page.js`

- [ ] **Step 1: Replace** 4-style dropdown with `LayoutPicker` + set-default.
- [ ] **Step 2: Commit** `feat(templates): customization uses ten-layout picker`

---

### Task 12: End-to-end verification

- [ ] **Step 1: Create** invoice with Soft Card + colour + logo center → preview matches.
- [ ] **Step 2: Bulk apply** Ledger to 3 invoices → downloads use Ledger.
- [ ] **Step 3: Quotation** same layout works with “Quotation” label.
- [ ] **Step 4: Long doc** PDF totals not cut across pages.
- [ ] **Step 5: Legacy** template with `style: "professional"` still renders Modern.

---

## Execution order

1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12

Do not skip Task 6 (preview) or Task 10 (page-break fix).
