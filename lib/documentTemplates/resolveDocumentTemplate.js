import { parseTemplateContent } from './parseTemplateContent.js';

/**
 * Resolve appearance for a document: explicit templateId → tenant default → built-in classic.
 *
 * @param {import('@prisma/client').PrismaClient} db
 * @param {{ tenantId: string, templateId?: string|null }} opts
 */
export async function resolveDocumentTemplate(db, { tenantId, templateId }) {
  if (!tenantId) {
    return buildResolved(null);
  }

  let template = null;
  if (templateId) {
    template = await db.invoiceTemplate.findFirst({
      where: { id: templateId, tenantId },
    });
  }

  if (!template) {
    template = await db.invoiceTemplate.findFirst({
      where: { tenantId, isDefault: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  if (!template) {
    template = await db.invoiceTemplate.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  return buildResolved(template);
}

function buildResolved(template) {
  const appearance = parseTemplateContent(template?.content);
  return {
    template,
    layoutId: appearance.layoutId,
    primaryColor: appearance.primaryColor,
    logoPosition: appearance.logoPosition,
    showLogo: appearance.showLogo,
    showFooter: appearance.showFooter,
    appearance,
  };
}
