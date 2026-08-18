"use client";
import { tt } from '@/lib/i18n/runtime';

import { Wand2 } from "lucide-react";
import { useSetupWizard } from "@/components/setup/SetupWizardContext";

/**
 * Header control to reopen the business setup wizard from the dashboard.
 */
export default function DashboardSetupWizardButton() {
  const { openWizard, isOpen } = useSetupWizard();

  return (
    <button
      type="button"
      onClick={() => openWizard()}
      disabled={isOpen}
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-default)] bg-white text-[var(--text-secondary)] shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-default disabled:opacity-60"
      title={tt('Open setup wizard')}
      aria-label={tt('Open setup wizard')}
    >
      <Wand2 className="h-5 w-5" aria-hidden />
    </button>
  );
}
