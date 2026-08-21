'use client';

import React from 'react';
import { DOCUMENT_LAYOUTS, LOGO_POSITIONS } from '@/lib/documentTemplates/registry';
import DocumentTemplatePreview from '@/components/documentTemplates/DocumentTemplatePreview';

/**
 * Thumbnail grid + colour/logo controls + live full preview for document appearance.
 */
export default function LayoutPicker({
  value = {},
  onChange,
  documentType = 'invoice',
  branding,
  sampleDocument,
  showLivePreview = true,
  setAsDefault = false,
  onSetAsDefaultChange,
  compact = false,
}) {
  const layoutId = value.layoutId || 'classic';
  const primaryColor = value.primaryColor || '#1d4ed8';
  const logoPosition = value.logoPosition || 'left';
  const showLogo = value.showLogo !== false;

  const patch = (partial) => {
    onChange?.({
      layoutId,
      primaryColor,
      logoPosition,
      showLogo,
      ...partial,
    });
  };

  const previewTemplate = {
    content: {
      layoutId,
      primaryColor,
      logoPosition,
      showLogo,
      showFooter: true,
    },
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-gray-800 mb-2">Layout</p>
        <div className={`grid gap-2 ${compact ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'}`}>
          {DOCUMENT_LAYOUTS.map((layout) => {
            const active = layout.id === layoutId;
            return (
              <button
                key={layout.id}
                type="button"
                title={layout.description}
                onClick={() => patch({ layoutId: layout.id })}
                className={`rounded-lg border p-2 text-left transition ${
                  active
                    ? 'border-blue-600 ring-2 ring-blue-200 bg-blue-50/60'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <LayoutThumbnail accent={primaryColor || layout.previewAccent} layoutId={layout.id} />
                <p className="mt-1.5 text-xs font-semibold text-gray-800 truncate">{layout.name}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Colour
          <input
            type="color"
            className="h-9 w-14 cursor-pointer rounded border border-gray-300"
            value={primaryColor}
            onChange={(e) => patch({ primaryColor: e.target.value })}
          />
        </label>

        <div>
          <p className="text-sm text-gray-700 mb-1">Logo position</p>
          <div className="inline-flex rounded-md border border-gray-200 overflow-hidden">
            {LOGO_POSITIONS.map((pos) => (
              <button
                key={pos}
                type="button"
                onClick={() => patch({ logoPosition: pos })}
                className={`px-3 py-1.5 text-xs font-semibold capitalize ${
                  logoPosition === pos
                    ? 'bg-slate-800 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 pb-1">
          <input
            type="checkbox"
            checked={showLogo}
            onChange={(e) => patch({ showLogo: e.target.checked })}
          />
          Show logo
        </label>

        {typeof onSetAsDefaultChange === 'function' && (
          <label className="flex items-center gap-2 text-sm text-gray-700 pb-1">
            <input
              type="checkbox"
              checked={!!setAsDefault}
              onChange={(e) => onSetAsDefaultChange(e.target.checked)}
            />
            Set as default for all new documents
          </label>
        )}
      </div>

      {showLivePreview && (
        <div>
          <p className="text-sm font-medium text-gray-800 mb-2">Live preview</p>
          <div className="max-h-[28rem] overflow-auto rounded-lg border border-gray-200 bg-gray-100 p-3">
            <div className="origin-top scale-[0.72] sm:scale-90" style={{ width: '111%' }}>
              <DocumentTemplatePreview
                template={previewTemplate}
                branding={branding}
                document={sampleDocument}
                documentType={documentType}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LayoutThumbnail({ accent, layoutId }) {
  const bar = accent || '#1d4ed8';
  return (
    <div className="h-14 rounded-md bg-white border border-gray-100 overflow-hidden relative">
      {layoutId === 'modern' || layoutId === 'band-header' ? (
        <div className="h-4 w-full" style={{ backgroundColor: bar }} />
      ) : layoutId === 'bold-bar' ? (
        <div className="h-1.5 w-full" style={{ backgroundColor: bar }} />
      ) : layoutId === 'classic' ? (
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: bar }} />
      ) : null}
      <div className="p-1.5 space-y-1">
        <div className="h-1.5 w-1/3 rounded bg-gray-300" />
        <div className="h-1 w-full rounded bg-gray-100" />
        <div className="h-1 w-full rounded bg-gray-100" />
        <div className="ml-auto h-2 w-1/4 rounded" style={{ backgroundColor: `${bar}55` }} />
      </div>
    </div>
  );
}
