import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_LAYOUTS,
  getLayout,
  layoutIdToLegacyStyle,
  normalizeLayoutId,
  normalizeLogoPosition,
} from '../lib/documentTemplates/registry.js';
import { parseTemplateContent } from '../lib/documentTemplates/parseTemplateContent.js';

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
    expect(normalizeLayoutId('compact')).toBe('compact');
  });

  it('returns layout metadata for known ids', () => {
    expect(getLayout('split-brand').name).toBe('Split Brand');
    expect(getLayout('soft-card').id).toBe('soft-card');
  });

  it('normalizes logo position', () => {
    expect(normalizeLogoPosition('center')).toBe('center');
    expect(normalizeLogoPosition('RIGHT')).toBe('right');
    expect(normalizeLogoPosition('nope')).toBe('left');
  });

  it('parses content with layoutId from legacy style', () => {
    const parsed = parseTemplateContent({ style: 'professional', primaryColor: '#112233' });
    expect(parsed.layoutId).toBe('modern');
    expect(parsed.primaryColor).toBe('#112233');
    expect(parsed.logoPosition).toBe('left');
  });

  it('maps layout back to legacy style for PDF bridges', () => {
    expect(layoutIdToLegacyStyle('bold-bar')).toBe('bold');
    expect(layoutIdToLegacyStyle('modern')).toBe('professional');
  });
});
