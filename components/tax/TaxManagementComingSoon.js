"use client";
import { tt } from '@/lib/i18n/runtime';

import Link from "next/link";
import PageHeader from "@/components/shell/PageHeader";

export default function TaxManagementComingSoon({
  title,
  description,
  waveLabel = "later wave",
}) {
  return (
    <div className="container mx-auto py-2">
      <PageHeader title={title} description={description} />
      <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-muted)] p-6">
        <p className="text-sm text-[var(--text-secondary)]">
          This section is part of the Tax Management hub foundation. Full
          behaviour lands in {waveLabel}. Use{" "}
          <Link
            href="/tax-management"
            className="text-[var(--brand-primary)] underline-offset-2 hover:underline"
          >
            {tt('Dashboard')}
          </Link>
          ,{" "}
          <Link
            href="/tax-management/accounts"
            className="text-[var(--brand-primary)] underline-offset-2 hover:underline"
          >
            {tt('Tax codes')}
          </Link>
          , or{" "}
          <Link
            href="/tax-management/accounts"
            className="text-[var(--brand-primary)] underline-offset-2 hover:underline"
          >
            {tt('Accounts')}
          </Link>{" "}
          for live operations today.
        </p>
      </div>
    </div>
  );
}
