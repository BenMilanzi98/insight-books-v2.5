"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertCircle, X, ChevronRight } from "lucide-react";
import { useSetupWizard } from "@/components/setup/SetupWizardContext";

/**
 * Non-blocking reminder for tenant owners to finish optional setup steps.
 */
export default function SetupWizardReminderBanner() {
  const { openWizard } = useSetupWizard();
  const [data, setData] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [snoozing, setSnoozing] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/tenant/setup-wizard-status", { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (res.ok) setData(json);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const onUpdate = () => loadStatus();
    window.addEventListener("setup-wizard-updated", onUpdate);
    return () => window.removeEventListener("setup-wizard-updated", onUpdate);
  }, [loadStatus]);

  const snooze = async () => {
    try {
      setSnoozing(true);
      const res = await fetch("/api/tenant/setup-wizard/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "snooze", days: 7 }),
        credentials: "include",
      });
      if (res.ok) setDismissed(true);
    } finally {
      setSnoozing(false);
    }
  };

  if (dismissed || !data?.showDashboardReminder || !data.pendingStepIds?.length) {
    return null;
  }

  const preview = data.pendingStepIds
    .slice(0, 4)
    .map((id) => {
      const step = data.steps?.find((s) => s.id === id);
      return step?.label?.split(" ")[0] ?? id;
    })
    .join(", ");
  const more = data.pendingCount > 4 ? ` +${data.pendingCount - 4} more` : "";

  return (
    <div className="mb-6 rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50/90 px-4 py-3 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3 min-w-0">
          <div className="flex-shrink-0 mt-0.5">
            <AlertCircle className="h-5 w-5 text-amber-700" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-950">Finish your business setup</p>
            <p className="mt-1 text-xs text-amber-900/90">
              Resume account, stock, customers, suppliers, or opening balances. Still pending:{" "}
              <span className="font-medium">{preview}</span>
              {more}.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openWizard()}
                className="inline-flex items-center rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
              >
                Open setup wizard
                <ChevronRight className="ml-1 h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={snooze}
                disabled={snoozing}
                className="inline-flex items-center rounded-lg border border-amber-300 bg-white/80 px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-white disabled:opacity-50"
              >
                Remind me in 7 days
              </button>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="self-start rounded-md p-1 text-amber-800/70 hover:bg-amber-100/80 hover:text-amber-950"
          aria-label="Dismiss banner for this session"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
