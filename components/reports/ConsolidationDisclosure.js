'use client';

import { Info } from 'lucide-react';
import { formatCurrency } from '@/lib/currencyUtils';

/**
 * Shows group consolidation notes when multi-business reports include FX, harmonized CoA, or IC elimination.
 * @param {{ consolidation?: object|null, className?: string }} props
 */
export default function ConsolidationDisclosure({ consolidation, className = '' }) {
  if (!consolidation) return null;

  const {
    reportingCurrency,
    currenciesUsed = [],
    fxTranslationApplied,
    harmonizedCoa,
    intercompanyElimination,
    notes = [],
  } = consolidation;

  const hasContent =
    fxTranslationApplied ||
    intercompanyElimination?.eliminationAmount > 0 ||
    (harmonizedCoa && notes.some((n) => /harmonized|translated|Inter-company/i.test(n)));

  if (!hasContent) return null;

  return (
    <div
      className={`rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm text-blue-950 ${className}`}
      role="note"
      aria-label="Group consolidation disclosure"
    >
      <div className="flex gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" aria-hidden />
        <div className="space-y-2 min-w-0">
          <p className="font-medium text-blue-900">
            Group consolidation
            {reportingCurrency ? ` (${reportingCurrency})` : ''}
          </p>
          {notes.length > 0 ? (
            <ul className="list-disc pl-4 space-y-1 text-blue-800/90">
              {notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
          {fxTranslationApplied && currenciesUsed.length > 1 ? (
            <p className="text-xs text-blue-700">
              Source currencies: {currenciesUsed.join(', ')}
            </p>
          ) : null}
          {intercompanyElimination?.eliminationAmount > 0 ? (
            <p className="text-xs text-blue-700">
              Inter-company elimination:{' '}
              {formatCurrency(intercompanyElimination.eliminationAmount, reportingCurrency || 'MWK')}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
