'use client';

import React from 'react';
import DocumentTemplatePreview from '@/components/documentTemplates/DocumentTemplatePreview';

/**
 * Backward-compatible invoice preview — delegates to shared DocumentTemplatePreview.
 */
const InvoiceTemplatePreview = ({ template, branding, invoice, isPrint = false }) => (
  <DocumentTemplatePreview
    template={template}
    branding={branding}
    invoice={invoice}
    documentType="invoice"
    isPrint={isPrint}
  />
);

export default InvoiceTemplatePreview;
