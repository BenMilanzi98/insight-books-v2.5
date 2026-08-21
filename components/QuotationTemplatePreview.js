'use client';

import React, { forwardRef } from 'react';
import DocumentTemplatePreview from '@/components/documentTemplates/DocumentTemplatePreview';

/**
 * Quotation preview — shared layouts with Invoice via DocumentTemplatePreview.
 */
const QuotationTemplatePreview = forwardRef(function QuotationTemplatePreview(
  { quotation, template, branding, currency = 'MWK', isPrint = false },
  ref
) {
  const mergedBranding = {
    ...branding,
    primaryColor: branding?.primaryColor,
  };

  return (
    <div ref={ref}>
      <DocumentTemplatePreview
        template={template || { content: { layoutId: 'classic', primaryColor: branding?.primaryColor || '#1f2937' } }}
        branding={mergedBranding}
        quotation={quotation}
        documentType="quotation"
        isPrint={isPrint}
      />
    </div>
  );
});

export default QuotationTemplatePreview;
