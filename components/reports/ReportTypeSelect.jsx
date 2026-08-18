'use client';

import { tt } from '@/lib/i18n/runtime';
import { useMemo, useRef, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import PortalPopover from '@/components/ui/PortalPopover';
import { DashboardDropdownShell, DashboardDropdownTrigger } from '@/components/ui/DashboardDropdown';

function findReport(categories, value) {
  for (const cat of categories || []) {
    const match = cat.reports.find((r) => r.type === value);
    if (match) return match;
  }
  return null;
}

function CompactReportOption({ active, children, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        'w-full truncate rounded px-2 py-1 text-left text-xs transition-colors',
        active
          ? 'bg-blue-50 font-medium text-blue-700'
          : 'text-gray-700 hover:bg-gray-50'
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Grouped report-type picker for /reports-v2 — compact Dashboard-style dropdown.
 */
export default function ReportTypeSelect({ categories, value, onChange, className = '' }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);

  const report = useMemo(() => findReport(categories, value), [categories, value]);

  if (!categories?.length || !onChange) return null;

  return (
    <DashboardDropdownShell className={className}>
      <div className="relative">
        <DashboardDropdownTrigger
          ref={triggerRef}
          compact
          icon={BarChart3}
          label={tt(report?.name || 'Select report')}
          open={open}
          onClick={() => setOpen((v) => !v)}
        />

        <PortalPopover
          open={open}
          onClose={() => setOpen(false)}
          anchorRef={triggerRef}
          align="start"
          variant="dashboard"
          estimatedWidth={260}
          estimatedHeight={220}
          bodyClassName="p-2"
          className="min-w-[min(260px,calc(100vw-16px))] max-w-[280px]"
        >
          <div className="max-h-[min(50vh,280px)] overflow-y-auto">
            {categories.map((cat, catIdx) => (
              <div key={cat.name} className={catIdx > 0 ? 'mt-1.5 border-t border-gray-100 pt-1.5' : ''}>
                <p className="mb-0.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  {tt(cat.name)}
                </p>
                <div>
                  {cat.reports.map((r) => (
                    <CompactReportOption
                      key={r.type}
                      active={value === r.type}
                      title={r.description ? tt(r.description) : undefined}
                      onClick={() => {
                        onChange(r.type);
                        setOpen(false);
                      }}
                    >
                      {tt(r.name)}
                    </CompactReportOption>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </PortalPopover>
      </div>
    </DashboardDropdownShell>
  );
}
