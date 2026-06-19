"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import SetupWizard from "@/components/setup/SetupWizard";
import { useSetupWizardContext } from "@/components/setup/SetupWizardContext";

const LS_PROCEEDED = "insightBooks_setupWelcome_proceeded";
const SS_DISMISS = "insightBooks_setupWelcome_sessionDismiss";

/**
 * Full-screen setup wizard modal on the dashboard. Auto-opens for new owners;
 * can also be opened via useSetupWizard().openWizard().
 */
export default function SetupWizardHost() {
  const ctx = useSetupWizardContext();
  const open = ctx?.open ?? false;
  const initialStepId = ctx?.initialStepId ?? null;
  const closeWizard = ctx?.closeWizard ?? (() => {});
  const openWizard = ctx?.openWizard ?? (() => {});

  const [autoEligible, setAutoEligible] = useState(false);
  const [statusChecked, setStatusChecked] = useState(false);

  const refreshEligibility = useCallback(async () => {
    try {
      const res = await fetch("/api/tenant/setup-wizard-status", { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.showWelcomeSetupModal) {
        setAutoEligible(true);
      } else {
        setAutoEligible(false);
      }
    } catch {
      setAutoEligible(false);
    } finally {
      setStatusChecked(true);
    }
  }, []);

  useEffect(() => {
    refreshEligibility();
  }, [refreshEligibility]);

  useEffect(() => {
    const onOpen = () => openWizard("capital");
    window.addEventListener("setup-wizard-open", onOpen);
    return () => window.removeEventListener("setup-wizard-open", onOpen);
  }, [openWizard]);

  useEffect(() => {
    if (!statusChecked || open) return;
    if (typeof window === "undefined") return;
    if (!autoEligible) return;
    if (window.localStorage.getItem(LS_PROCEEDED)) return;
    if (window.sessionStorage.getItem(SS_DISMISS)) return;
    ctx?.openWizard?.("capital");
  }, [statusChecked, autoEligible, open, openWizard]);

  const isVisible = open;

  useEffect(() => {
    if (!isVisible) return;
    const onKey = (e) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isVisible]);

  const handleClose = () => {
    try {
      window.sessionStorage.setItem(SS_DISMISS, "1");
    } catch {
      /* ignore */
    }
    closeWizard();
  };

  const handleWizardClose = () => {
    try {
      window.localStorage.setItem(LS_PROCEEDED, "1");
      window.sessionStorage.setItem(SS_DISMISS, "1");
      window.dispatchEvent(new CustomEvent("setup-wizard-updated"));
    } catch {
      /* ignore */
    }
    closeWizard();
    refreshEligibility();
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-wizard-modal-title"
    >
      <div
        className="relative flex h-[min(92vh,900px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 shadow-2xl shadow-indigo-950/40"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-3 top-3 z-20 rounded-xl bg-white/90 p-2 text-slate-500 shadow-sm ring-1 ring-slate-200/80 hover:bg-white hover:text-slate-800 sm:right-4 sm:top-4"
          aria-label="Close setup wizard"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6 sm:py-8">
          <Suspense
            fallback={
              <div className="flex min-h-[40vh] items-center justify-center gap-2 text-slate-500">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                <span className="text-sm">Loading wizard…</span>
              </div>
            }
          >
            <SetupWizard embedded initialStepId={initialStepId} onClose={handleWizardClose} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
