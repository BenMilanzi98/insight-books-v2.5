'use client';

import { useRef, useState } from 'react';
import { BarChart3, Download, Loader2, MoreHorizontal, Printer, Send } from 'lucide-react';
import ReportTypeSelect from '@/components/reports/ReportTypeSelect';
import PortalPopover from '@/components/ui/PortalPopover';
import { DashboardMenuItem } from '@/components/ui/DashboardMenuPanel';
import { DashboardDropdownShell, DashboardDropdownTrigger } from '@/components/ui/DashboardDropdown';

function ReportStudioToolbar({
  menuOpen,
  setMenuOpen,
  menuTriggerRef,
  exportFormats,
  onExport,
  exportUrl,
  filtersOpen,
  onToggleFilters,
  reportTypeCategories,
  reportType,
  onReportTypeChange,
}) {
  return (
    <>
      <ReportTypeSelect
        categories={reportTypeCategories}
        value={reportType}
        onChange={onReportTypeChange}
      />

      <DashboardDropdownShell>
        <div className="relative">
          <DashboardDropdownTrigger
            ref={menuTriggerRef}
            compact
            icon={MoreHorizontal}
            label="More Actions"
            open={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="min-w-[8.5rem]"
          />

          <PortalPopover
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            anchorRef={menuTriggerRef}
            align="end"
            variant="dashboard"
            estimatedWidth={200}
            estimatedHeight={120}
            bodyClassName="p-2"
            className="min-w-[10rem]"
          >
            <div className="space-y-0.5">
              {exportFormats.map((f) => (
                <DashboardMenuItem
                  key={f}
                  className="px-2 py-1.5 text-xs"
                  onClick={() => {
                    setMenuOpen(false);
                    if (onExport) onExport(f);
                    else {
                      const url = exportUrl?.(f);
                      if (url) window.location.href = url;
                    }
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Export {f.toUpperCase()}
                  </span>
                </DashboardMenuItem>
              ))}
              <DashboardMenuItem
                className="px-2 py-1.5 text-xs"
                onClick={() => {
                  setMenuOpen(false);
                  window.print();
                }}
              >
                <span className="flex items-center gap-2">
                  <Printer className="h-4 w-4" />
                  Print
                </span>
              </DashboardMenuItem>
            </div>
          </PortalPopover>
        </div>
      </DashboardDropdownShell>

      <button
        type="button"
        disabled
        title="Email send is not configured for financial reports"
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white opacity-60"
      >
        <Send className="h-3.5 w-3.5" />
        Send…
      </button>
      {filtersOpen ? (
        <button
          type="button"
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 lg:hidden"
          onClick={onToggleFilters}
        >
          Filters
        </button>
      ) : (
        <button
          type="button"
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          onClick={() => onToggleFilters(true)}
        >
          Filters
        </button>
      )}
    </>
  );
}

/**
 * FreshBooks-inspired chrome shared by all /reports-v2 statements.
 */
export default function ReportStudioShell({
  showPageHeader = false,
  reportTitle,
  loading = false,
  loadingLabel = 'Generating report…',
  error = null,
  exportUrl,
  exportFormats = ['csv', 'xlsx', 'pdf'],
  onExport,
  footer,
  filters,
  filtersOpen,
  onToggleFilters,
  reportTypeCategories,
  reportType,
  onReportTypeChange,
  children,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTriggerRef = useRef(null);

  const toolbar = (
    <ReportStudioToolbar
      menuOpen={menuOpen}
      setMenuOpen={setMenuOpen}
      menuTriggerRef={menuTriggerRef}
      exportFormats={exportFormats}
      onExport={onExport}
      exportUrl={exportUrl}
      filtersOpen={filtersOpen}
      onToggleFilters={onToggleFilters}
      reportTypeCategories={reportTypeCategories}
      reportType={reportType}
      onReportTypeChange={onReportTypeChange}
    />
  );

  return (
    <div className="space-y-4">
      {showPageHeader ? (
        <div className="mb-2 flex flex-col gap-4 lg:mb-0 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Reports</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-800">
              <BarChart3 className="h-3.5 w-3.5" aria-hidden />
              Financial
            </span>
            {reportTitle ? (
              <>
                <span className="hidden text-slate-300 sm:inline" aria-hidden>
                  |
                </span>
                <span className="text-xl font-bold text-slate-800 sm:text-2xl">{reportTitle}</span>
              </>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{toolbar}</div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-2">{toolbar}</div>
      )}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col lg:flex-row">
          <div className="min-w-0 flex-1 p-4 sm:p-6">
            {loading ? (
              <div className="flex items-center gap-2 py-12 text-slate-600">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                {loadingLabel}
              </div>
            ) : (
              children
            )}

            {footer ? <div className="mt-6 text-xs leading-relaxed text-slate-400">{footer}</div> : null}
          </div>

          {filtersOpen ? <div className="lg:block">{filters}</div> : null}
        </div>
      </div>
    </div>
  );
}
