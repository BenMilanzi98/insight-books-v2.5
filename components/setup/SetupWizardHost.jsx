"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, ArrowRight } from "lucide-react";
import { useSetupWizardContext } from "@/components/setup/SetupWizardContext";

const LS_PROCEEDED = "insightBooks_setupWelcome_proceeded";
const SS_DISMISS = "insightBooks_setupWelcome_sessionDismiss";

/**
 * A3 hybrid launcher: soft welcome banner on dashboard; primary path is full-page /setup.
 * Does not force completed businesses into setup on login.
 */
export default function SetupWizardHost() {
  const ctx = useSetupWizardContext();
  const closeWizard = ctx?.closeWizard ?? (() => {});
  const open = ctx?.open ?? false;
  const router = useRouter();

  const [autoEligible, setAutoEligible] = useState(false);
  const [statusChecked, setStatusChecked] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(false);

  const goToSetup = useCallback(() => {
    try {
      window.localStorage.setItem(LS_PROCEEDED, "1");
      window.sessionStorage.setItem(SS_DISMISS, "1");
    } catch {
      /* ignore */
    }
    closeWizard();
    router.push("/setup");
  }, [closeWizard, router]);

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
    const onOpen = () => goToSetup();
    window.addEventListener("setup-wizard-open", onOpen);
    return () => window.removeEventListener("setup-wizard-open", onOpen);
  }, [goToSetup]);

  useEffect(() => {
    if (open) {
      goToSetup();
    }
  }, [open, goToSetup]);

  useEffect(() => {
    if (!statusChecked) return;
    if (typeof window === "undefined") return;
    if (!autoEligible) return;
    if (window.localStorage.getItem(LS_PROCEEDED)) return;
    if (window.sessionStorage.getItem(SS_DISMISS)) return;
    setBannerOpen(true);
  }, [statusChecked, autoEligible]);

  const dismissBanner = () => {
    try {
      window.sessionStorage.setItem(SS_DISMISS, "1");
    } catch {
      /* ignore */
    }
    setBannerOpen(false);
  };

  if (!bannerOpen) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-[180] mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-4 shadow-lg sm:left-auto"
      role="dialog"
      aria-label="Continue business setup"
    >
      <button
        type="button"
        onClick={dismissBanner}
        className="absolute right-2 top-2 rounded-md p-1 text-slate-400 hover:text-slate-700"
        aria-label="Dismiss setup reminder"
      >
        <X className="h-4 w-4" />
      </button>
      <p className="pr-8 text-sm font-semibold text-slate-900">Finish business setup</p>
      <p className="mt-1 text-sm text-slate-600">
        Configure your profile, calendar, and opening balances in the Setup Wizard. You can leave
        and resume anytime.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={goToSetup}
          className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
        >
          Continue setup <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
        <Link
          href="/setup"
          className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
          onClick={() => {
            try {
              window.localStorage.setItem(LS_PROCEEDED, "1");
            } catch {
              /* ignore */
            }
          }}
        >
          Open /setup
        </Link>
      </div>
    </div>
  );
}
