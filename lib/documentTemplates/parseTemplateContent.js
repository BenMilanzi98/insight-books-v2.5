import {
  layoutIdToLegacyStyle,
  normalizeLayoutId,
  normalizeLogoPosition,
} from './registry.js';

/**
 * Parse InvoiceTemplate.content (string or object) into a normalized appearance object.
 */
export function parseTemplateContent(raw) {
  let content = {};
  try {
    if (typeof raw === 'string') {
      content = JSON.parse(raw || '{}') || {};
    } else if (raw && typeof raw === 'object') {
      content = { ...raw };
    }
  } catch {
    content = {};
  }

  const layoutId = normalizeLayoutId(content.layoutId || content.style);
  const primaryColor =
    (typeof content.primaryColor === 'string' && content.primaryColor.trim()) ||
    '#1d4ed8';
  const logoPosition = normalizeLogoPosition(content.logoPosition);
  const showLogo = content.showLogo !== false;
  const showFooter = content.showFooter !== false;

  return {
    ...content,
    layoutId,
    style: content.style || layoutIdToLegacyStyle(layoutId),
    primaryColor,
    logoPosition,
    showLogo,
    showFooter,
  };
}

export function serializeTemplateContent(appearance) {
  const normalized = parseTemplateContent(appearance || {});
  return JSON.stringify({
    layoutId: normalized.layoutId,
    style: normalized.style,
    primaryColor: normalized.primaryColor,
    logoPosition: normalized.logoPosition,
    showLogo: normalized.showLogo,
    showFooter: normalized.showFooter,
  });
}
