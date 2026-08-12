"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  Circle,
  Loader2,
  PartyPopper,
  Package,
  SkipForward,
  Sparkles,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { SETUP_WIZARD_STEP_DEFS, getSetupStepDef } from "@/lib/setupWizardStepsMeta";
import SetupWizardStepContent from "@/components/setup/SetupWizardStepContent";

const STEP_ICONS = {
  accountSettings: Building2,
  inventory: Package,
  customers: Users,
  clients: Users,
  suppliers: Truck,
  openingBalances: Wallet,
  openingStock: Package,
};

function factLabel(stepId, facts) {
  if (!facts) return null;
  switch (stepId) {
    case "accountSettings":
      return facts.accountSettingsComplete ? facts.tenantName || "Account ready" : "Add business details";
    case "inventory":
    case "openingStock":
      return facts.hasOpeningStock
        ? `${facts.stockedProductCount} product${facts.stockedProductCount === 1 ? "" : "s"} with stock`
        : "No opening stock recorded";
    case "customers":
    case "clients":
      return facts.clientCount > 0
        ? `${facts.clientCount} customer${facts.clientCount === 1 ? "" : "s"}`
        : "No customers yet";
    case "suppliers":
      return facts.supplierCount > 0
        ? `${facts.supplierCount} supplier${facts.supplierCount === 1 ? "" : "s"}`
        : "No suppliers yet";
    case "openingBalances":
    case "openingBalancesReview":
      return facts.hasOpeningBalancesReview ? "Opening balances posted" : "No opening cash posted";
    default:
      return null;
  }
}

function StatusPill({ status }) {
  if (status === "complete") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-500/25">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Done
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/10 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-400/20">
        <SkipForward className="h-3.5 w-3.5" />
        Skipped
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-500/25">
      <Circle className="h-3 w-3 fill-amber-500 text-amber-500" />
      Pending
    </span>
  );
}

/**
 * @param {{ embedded?: boolean, onClose?: () => void, initialStepId?: string | null }} props
 */
export default function SetupWizard({ embedded = false, onClose, initialStepId = null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [payload, setPayload] = useState(null);
  const [busy, setBusy] = useState(null);
  const [activeId, setActiveId] = useState(SETUP_WIZARD_STEP_DEFS[0]?.id);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tenant/setup-wizard-status", { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not load setup status");
      setPayload(json);
    } catch (e) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleStepSaved = useCallback(async () => {
    await load();
    try {
      window.dispatchEvent(new CustomEvent("setup-wizard-updated"));
    } catch {
      /* ignore */
    }
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  const steps = payload?.steps ?? [];
  const facts = payload?.facts ?? null;

  const completedCount = steps.filter((s) => s.status === "complete").length;
  const progressPct = steps.length ? Math.round((completedCount / steps.length) * 100) : 0;

  const pendingIds = useMemo(
    () => steps.filter((s) => s.status === "pending").map((s) => s.id),
    [steps]
  );

  useEffect(() => {
    if (embedded && initialStepId && getSetupStepDef(initialStepId)) {
      setActiveId(initialStepId);
      return;
    }
    if (!embedded) {
      const fromUrl = searchParams.get("step");
      if (fromUrl && getSetupStepDef(fromUrl)) {
        setActiveId(fromUrl);
        return;
      }
    }
    if (!steps.length) return;
    const firstPending = steps.find((s) => s.status === "pending");
    if (firstPending) setActiveId(firstPending.id);
    else if (steps[0]) setActiveId(steps[0].id);
  }, [embedded, initialStepId, searchParams, steps]);

  const setActiveStep = (stepId) => {
    setActiveId(stepId);
    if (!embedded) {
      router.replace(`/setup?step=${encodeURIComponent(stepId)}`, { scroll: false });
    }
  };

  const activeIndex = steps.findIndex((s) => s.id === activeId);
  const activeStep = steps[activeIndex] ?? steps[0];
  const meta = getSetupStepDef(activeStep?.id) ?? SETUP_WIZARD_STEP_DEFS[0];
  const StepIcon = STEP_ICONS[meta.id] ?? Sparkles;

  const finishWizard = () => {
    if (embedded && onClose) onClose();
    else router.push("/dashboard");
  };

  const postStep = async (body) => {
    const res = await fetch("/api/tenant/setup-wizard/step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Request failed");
    await load();
    return json;
  };

  const goNext = () => {
    if (activeIndex < steps.length - 1) {
      setActiveStep(steps[activeIndex + 1].id);
    }
  };

  const goPrev = () => {
    if (activeIndex > 0) {
      setActiveStep(steps[activeIndex - 1].id);
    }
  };

  const handleComplete = async () => {
    if (!activeStep) return;
    try {
      setBusy("complete");
      await postStep({ action: "complete", stepId: activeStep.id });
      if (activeIndex >= steps.length - 1) {
        finishWizard();
        return;
      }
      const next = steps.slice(activeIndex + 1).find((s) => s.status === "pending");
      if (next) setActiveStep(next.id);
      else goNext();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const handleSkip = async () => {
    if (!activeStep) return;
    try {
      setBusy("skip");
      await postStep({ action: "skip", stepId: activeStep.id });
      goNext();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const handleSkipAll = async () => {
    if (
      !window.confirm(
        "Skip all remaining setup steps? You can reopen the wizard anytime from the dashboard."
      )
    ) {
      return;
    }
    try {
      setBusy("skipAll");
      await postStep({ action: "skipAll", stepIds: pendingIds });
      finishWizard();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const loadingMinH = embedded ? "min-h-[40vh]" : "min-h-[70vh]";

  if (loading) {
    return (
      <div className={`flex ${loadingMinH} flex-col items-center justify-center gap-3 text-slate-500`}>
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="text-sm font-medium">Preparing your workspace…</p>
      </div>
    );
  }

  if (!payload?.isTenantOwner) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200/80 bg-white p-8 shadow-xl shadow-slate-200/50">
        <p className="text-lg font-semibold text-slate-900">Business owner only</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Only the registered business owner can run the setup wizard. Ask your owner to sign in, or
          open the linked pages directly if you have permission.
        </p>
        {embedded ? (
          <button
            type="button"
            onClick={onClose}
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Close
          </button>
        ) : (
          <Link
            href="/dashboard"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
        )}
      </div>
    );
  }

  if (payload.allComplete) {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-10 shadow-2xl shadow-emerald-900/10">
          <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-teal-400/20 blur-3xl" />
          <div className="relative">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30">
              <PartyPopper className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">You&apos;re all set!</h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600">
              Every setup step is complete or skipped. You can revisit capital, assets, taxes, and
              contacts anytime from the main menu.
            </p>
            {embedded ? (
              <button
                type="button"
                onClick={finishWizard}
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-105"
              >
                Back to dashboard
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <Link
                href="/dashboard"
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-105"
              >
                Go to dashboard
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? "" : "mx-auto max-w-6xl"}>
      {/* Top bar */}
      <div className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${embedded ? "mb-5" : "mb-8"}`}>
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-700">
            <Sparkles className="h-3.5 w-3.5" />
            Get started
          </div>
          <h1
            id={embedded ? "setup-wizard-modal-title" : undefined}
            className={`mt-3 font-bold tracking-tight text-slate-900 ${embedded ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"}`}
          >
            Complete your setup
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
            Five steps: account, stock, customers, suppliers, and opening cash balances. Skip for now
            and resume anytime from the dashboard.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="text-xs font-medium text-slate-500">
            {completedCount} of {steps.length} complete
          </span>
          <div className="h-2.5 w-48 overflow-hidden rounded-full bg-slate-200/80 sm:w-56">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-sky-500 transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <button
            type="button"
            onClick={finishWizard}
            className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
          >
            Skip for Now
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className={`grid gap-6 ${embedded ? "lg:grid-cols-[240px_1fr]" : "lg:grid-cols-[280px_1fr]"}`}>
        {/* Step rail */}
        <nav
          className={`rounded-2xl border border-slate-200/80 bg-white/80 p-3 shadow-lg shadow-slate-200/40 backdrop-blur-sm ${embedded ? "" : "lg:sticky lg:top-6 lg:self-start"}`}
          aria-label="Setup steps"
        >
          <ul className="space-y-1">
            {steps.map((step, idx) => {
              const def = getSetupStepDef(step.id);
              const Icon = STEP_ICONS[step.id] ?? Circle;
              const isActive = step.id === activeId;
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    onClick={() => setActiveStep(step.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-md shadow-blue-500/25"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        isActive ? "bg-white/20" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {step.status === "complete" ? (
                        <CheckCircle2 className={`h-5 w-5 ${isActive ? "text-white" : "text-emerald-600"}`} />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm font-semibold ${isActive ? "text-white" : ""}`}>
                        {def?.shortLabel ?? step.label}
                      </span>
                      <span className={`block text-[10px] ${isActive ? "text-indigo-100" : "text-slate-400"}`}>
                        Step {idx + 1}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {embedded ? (
            <button
              type="button"
              onClick={onClose}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Continue later
            </button>
          ) : (
            <Link
              href="/dashboard"
              className="mt-4 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Continue later
            </Link>
          )}
        </nav>

        {/* Active step panel */}
        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-300/30">
          <div
            className={`relative bg-gradient-to-br ${meta.gradient} ${embedded ? "px-5 py-6 sm:px-8" : "px-6 py-10 sm:px-10 sm:py-12"}`}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.25),transparent_50%)]" />
            <div className="pointer-events-none absolute -right-16 top-8 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-xl">
                <div
                  className={`mb-3 inline-flex items-center justify-center rounded-2xl bg-white/20 text-white shadow-lg backdrop-blur-sm ${embedded ? "h-11 w-11" : "mb-4 h-14 w-14"}`}
                >
                  <StepIcon className={embedded ? "h-5 w-5" : "h-7 w-7"} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className={`font-bold text-white ${embedded ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"}`}>
                    {meta.label}
                  </h2>
                  {activeStep && <StatusPill status={activeStep.status} />}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-white/90">{meta.description}</p>
                {factLabel(activeStep?.id, facts) && (
                  <p className="mt-3 inline-flex rounded-lg bg-black/20 px-3 py-1.5 text-xs font-medium text-white/95 backdrop-blur-sm">
                    {factLabel(activeStep?.id, facts)}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-5 p-5 sm:p-7">
            <SetupWizardStepContent
              stepId={activeStep?.id}
              facts={facts}
              onSaved={handleStepSaved}
              onError={setError}
            />

            <details className="rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-slate-500">
                Tips for this step
              </summary>
              <ul className="mt-2 space-y-1.5">
                {meta.tips.map((tip) => (
                  <li key={tip} className="flex gap-2 text-sm text-slate-600">
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </details>

            {activeStep?.status === "pending" && (
              <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={handleComplete}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50 sm:flex-none"
                >
                  {busy === "complete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {activeIndex === steps.length - 1 ? "Complete Setup" : "Mark step as done"}
                </button>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={handleSkip}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 sm:flex-none"
                >
                  {busy === "skip" ? <Loader2 className="h-4 w-4 animate-spin" /> : <SkipForward className="h-4 w-4" />}
                  Skip this step
                </button>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={goPrev}
                disabled={activeIndex <= 0}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-30"
              >
                <ArrowLeft className="h-4 w-4" />
                Previous
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={activeIndex >= steps.length - 1}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-30"
              >
                Next step
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-3">
              <p className="text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Advanced:</span>{" "}
                <button
                  type="button"
                  className="font-medium text-indigo-600 hover:underline"
                  onClick={async () => {
                    try {
                      await fetch("/api/chart-of-accounts/bootstrap", {
                        method: "POST",
                        credentials: "include",
                      });
                      await load();
                    } catch {
                      /* non-fatal */
                    }
                  }}
                >
                  Run financial bootstrap
                </button>{" "}
                — seeds chart of accounts, payment defaults, and tax GL gaps.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
