"use client";

import { useCallback, useEffect, useState } from "react";
import { useSetupWizardContext } from "@/components/setup/SetupWizardContext";
import SetupWizard from "@/components/setup/SetupWizard";

const SS_DISMISS = "insightBooks_setupWizard_sessionDismiss";

/**
 * Auto-opens the 5-step dashboard wizard after login when setup is incomplete.
 * Skip for Now dismisses for this session; the dashboard banner can resume.
 * Does not open the advanced /setup 23-step wizard.
 */
export default function SetupWizardHost() {
  const ctx = useSetupWizardContext();
  const closeWizard = ctx?.closeWizard ?? (() => {});
  const openWizard = ctx?.openWizard ?? (() => {});
  const open = ctx?.open ?? false;
  const initialStepId = ctx?.initialStepId ?? null;

  const [statusChecked, setStatusChecked] = useState(false);

  const refreshEligibility = useCallback(async () => {
    try {
      const res = await fetch("/api/tenant/setup-wizard-status", { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return;
      if (typeof window !== "undefined" && window.sessionStorage.getItem(SS_DISMISS)) {
        return;
      }
      if (json.showWelcomeSetupModal || (json.isTenantOwner && json.pendingCount > 0 && !json.allComplete)) {
        openWizard();
      }
    } catch {
      /* ignore */
    } finally {
      setStatusChecked(true);
    }
  }, [openWizard]);

  useEffect(() => {
    refreshEligibility();
  }, [refreshEligibility]);

  const handleClose = useCallback(() => {
    try {
      window.sessionStorage.setItem(SS_DISMISS, "1");
    } catch {
      /* ignore */
    }
    closeWizard();
    try {
      window.dispatchEvent(new CustomEvent("setup-wizard-updated"));
    } catch {
      /* ignore */
    }
  }, [closeWizard]);

  if (!statusChecked || !open) return null;

  return (
    <div
      className="fixed inset-0 overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm"
      style={{ zIndex: "var(--z-modal, 500)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-wizard-modal-title"
    >
      <div className="mx-auto mt-6 max-w-6xl rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
        <SetupWizard embedded onClose={handleClose} initialStepId={initialStepId} />
      </div>
    </div>
  );
}
