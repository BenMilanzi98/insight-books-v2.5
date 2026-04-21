"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X } from "lucide-react";

const LS_PROCEEDED = "insightBooks_setupWelcome_proceeded";
const SS_DISMISS = "insightBooks_setupWelcome_sessionDismiss";

/**
 * Modal for business owners who have not started financial setup (all wizard steps still pending).
 */
export default function SetupWizardWelcomeModal() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/tenant/setup-wizard-status", { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (res.ok) setData(json);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined" || !data?.showWelcomeSetupModal) {
      setOpen(false);
      return;
    }
    if (window.localStorage.getItem(LS_PROCEEDED)) {
      setOpen(false);
      return;
    }
    if (window.sessionStorage.getItem(SS_DISMISS)) {
      setOpen(false);
      return;
    }
    setOpen(true);
  }, [data]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      try {
        window.sessionStorage.setItem(SS_DISMISS, "1");
      } catch {
        /* ignore */
      }
      setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleProceed = () => {
    try {
      window.localStorage.setItem(LS_PROCEEDED, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
    router.push("/setup");
  };

  const handleNotNow = () => {
    try {
      window.sessionStorage.setItem(SS_DISMISS, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-welcome-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-indigo-100 bg-white shadow-2xl shadow-indigo-900/20">
        <button
          type="button"
          onClick={handleNotNow}
          className="absolute right-3 top-3 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="p-6 pt-10 sm:p-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg">
            <Sparkles className="h-6 w-6" aria-hidden />
          </div>
          <h2 id="setup-welcome-title" className="text-center text-xl font-bold text-slate-900">
            Set up your finances
          </h2>
          <p className="mt-3 text-center text-sm text-slate-600 leading-relaxed">
            Complete a short guided checklist so reporting, tax defaults, and cash accounts stay aligned
            with your business.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
            <button
              type="button"
              onClick={handleProceed}
              className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 sm:w-auto sm:min-w-[160px]"
            >
              Proceed to setup
            </button>
            <button
              type="button"
              onClick={handleNotNow}
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
