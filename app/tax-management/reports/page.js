"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/shell/PageHeader";
import { getPermission } from "@/lib/permissions";

export default function TaxReportsPage() {
  const [canExport, setCanExport] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    getPermission("tax.export").then(setCanExport);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(now.toISOString().slice(0, 10));
  }, []);

  const exportCsv = () => {
    if (!startDate || !endDate) return;
    window.location.href = `/api/reports/tax-summary/export?startDate=${startDate}&endDate=${endDate}&format=csv`;
  };

  return (
    <div className="container mx-auto py-2">
      <PageHeader
        title="Tax reports"
        description="Operational tax reports with export matching screen filters."
      />
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="rounded border border-[var(--border-default)] p-4">
          <h2 className="mb-2 font-medium">Tax summary</h2>
          <p className="mb-3 text-sm text-[var(--text-secondary)]">
            Collected vs paid for a date range. Dashboard view:{" "}
            <Link href="/tax-management" className="text-[var(--brand-primary)] hover:underline">
              Tax Management home
            </Link>
            .
          </p>
          <div className="mb-3 flex flex-wrap gap-3">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded border border-[var(--border-default)] px-2 py-1 text-sm"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded border border-[var(--border-default)] px-2 py-1 text-sm"
            />
          </div>
          {canExport ? (
            <button
              type="button"
              onClick={exportCsv}
              className="rounded bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white"
            >
              Export CSV
            </button>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">
              Export requires tax.export permission.
            </p>
          )}
        </div>
        <div className="rounded border border-[var(--border-default)] p-4">
          <h2 className="mb-2 font-medium">Reconciliation</h2>
          <p className="mb-3 text-sm text-[var(--text-secondary)]">
            Subledger ↔ GL and reversal journal linkage checks.
          </p>
          <Link
            href="/tax-management/reconciliation"
            className="text-sm text-[var(--brand-primary)] hover:underline"
          >
            Open reconciliation →
          </Link>
        </div>
        <div className="rounded border border-[var(--border-default)] p-4">
          <h2 className="mb-2 font-medium">Tax codes & accounts</h2>
          <p className="mb-3 text-sm text-[var(--text-secondary)]">
            Per-type reports live on the tax codes screen.
          </p>
          <Link
            href="/tax-management/accounts"
            className="text-sm text-[var(--brand-primary)] hover:underline"
          >
            Open tax codes →
          </Link>
        </div>
        <div className="rounded border border-[var(--border-default)] p-4">
          <h2 className="mb-2 font-medium">Reversed taxes</h2>
          <p className="mb-3 text-sm text-[var(--text-secondary)]">
            Reversed tax lines export from tax codes / reversed-taxes APIs.
          </p>
          <Link
            href="/tax-management/accounts"
            className="text-sm text-[var(--brand-primary)] hover:underline"
          >
            Open tax codes →
          </Link>
        </div>
      </div>
    </div>
  );
}
