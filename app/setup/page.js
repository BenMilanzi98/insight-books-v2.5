"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import PermissionGuard from "@/components/PermissionGuard";
import { SETUP_WIZARD_STEP_DEFS } from "@/lib/setupWizardStepsMeta";
import {
  CheckCircle,
  Circle,
  SkipForward,
  ExternalLink,
  Loader2,
  CalendarRange,
} from "lucide-react";

function statusBadge(status) {
  if (status === "complete")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
        <CheckCircle className="h-3.5 w-3.5" />
        Done
      </span>
    );
  if (status === "skipped")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
        <SkipForward className="h-3.5 w-3.5" />
        Skipped
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
      <Circle className="h-3.5 w-3.5" />
      Pending
    </span>
  );
}

function goToNextWizardStep(completedStepId, router) {
  const idx = SETUP_WIZARD_STEP_DEFS.findIndex((s) => s.id === completedStepId);
  if (idx < 0 || idx >= SETUP_WIZARD_STEP_DEFS.length - 1) {
    router.push("/dashboard");
    return;
  }
  const next = SETUP_WIZARD_STEP_DEFS[idx + 1];
  if (next.href === "/setup" || next.href.startsWith("/setup?")) {
    router.push(`/setup?focus=${encodeURIComponent(next.id)}`);
  } else {
    router.push(next.href);
  }
}

function SetupWizardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [payload, setPayload] = useState(null);
  const [actionStep, setActionStep] = useState(null);
  const [fiscalMonth, setFiscalMonth] = useState(1);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tenant/setup-wizard-status", { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not load setup status");
      setPayload(json);
      const m = Number(json.fiscalYearStartMonth);
      if (Number.isFinite(m) && m >= 1 && m <= 12) setFiscalMonth(m);
    } catch (e) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const focus = searchParams.get("focus");
    if (!focus || loading || !payload) return;
    const id = `setup-step-${focus}`;
    const t = window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(t);
  }, [searchParams, loading, payload]);

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
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500 gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading setup…
      </div>
    );
  }

  if (!payload?.isTenantOwner) {
    return (
      <div className="max-w-2xl mx-auto rounded-xl border border-slate-200 bg-white p-6 text-slate-700">
        <p className="font-medium">Business owner only</p>
        <p className="mt-2 text-sm text-slate-600">
          Only the registered business owner can track or complete the optional setup wizard. Ask your
          owner to sign in, or use the linked pages directly if you have access.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-600 to-violet-700 px-6 py-8 text-white shadow-lg">
        <h1 className="text-2xl font-bold tracking-tight">Financial setup wizard</h1>
        <p className="mt-2 text-sm text-indigo-100 max-w-2xl">
          Every step is optional. Complete them in any order, or skip and finish later from the
          dashboard reminder. Links open the same screens the rest of the app uses.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={async () => {
              try {
                await fetch("/api/chart-of-accounts/bootstrap", { method: "POST", credentials: "include" });
                await load();
              } catch {
                /* non-fatal */
              }
            }}
            className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25"
          >
            Run financial bootstrap (CoA / payments / tax gaps)
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <ul className="space-y-4">
        {payload.steps?.map((step) => (
          <li
            key={step.id}
            id={`setup-step-${step.id}`}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-900">{step.label}</h2>
                  {statusBadge(step.status)}
                </div>
                <p className="mt-1 text-sm text-slate-600">{step.description}</p>
                {step.id === "fiscalYear" && step.status === "pending" && (
                  <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-3 border border-slate-100">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">First month of fiscal year</label>
                      <select
                        value={fiscalMonth}
                        onChange={(e) => setFiscalMonth(parseInt(e.target.value, 10))}
                        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      >
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {new Date(2000, i, 1).toLocaleString("en-US", { month: "long" })}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      disabled={actionStep === "fiscal"}
                      onClick={async () => {
                        try {
                          setActionStep("fiscal");
                          await postStep({
                            action: "complete",
                            stepId: "fiscalYear",
                            fiscalYearStartMonth: fiscalMonth,
                          });
                          goToNextWizardStep("fiscalYear", router);
                        } catch (e) {
                          setError(e.message);
                        } finally {
                          setActionStep(null);
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      <CalendarRange className="h-4 w-4" />
                      Save & mark as complete
                    </button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Link
                  href={step.href}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50"
                >
                  Open
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
                {step.status === "pending" && step.id !== "fiscalYear" && (
                  <>
                    <button
                      type="button"
                      disabled={!!actionStep}
                      onClick={async () => {
                        try {
                          setActionStep(step.id);
                          await postStep({ action: "complete", stepId: step.id });
                          goToNextWizardStep(step.id, router);
                        } catch (e) {
                          setError(e.message);
                        } finally {
                          setActionStep(null);
                        }
                      }}
                      className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      Mark as complete
                    </button>
                    <button
                      type="button"
                      disabled={!!actionStep}
                      onClick={async () => {
                        try {
                          setActionStep(step.id);
                          await postStep({ action: "skip", stepId: step.id });
                        } catch (e) {
                          setError(e.message);
                        } finally {
                          setActionStep(null);
                        }
                      }}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Skip for now
                    </button>
                  </>
                )}
                {step.status === "pending" && step.id === "fiscalYear" && (
                  <button
                    type="button"
                    disabled={!!actionStep}
                    onClick={async () => {
                      try {
                        setActionStep("skipFiscal");
                        await postStep({ action: "skip", stepId: "fiscalYear" });
                      } catch (e) {
                        setError(e.message);
                      } finally {
                        setActionStep(null);
                      }
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Skip fiscal step
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-center text-xs text-slate-500">
        <Link href="/dashboard" className="text-indigo-600 hover:underline">
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}

export default function SetupWizardPage() {
  return (
    <PermissionGuard permission="settings.view">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 py-8 px-4">
        <Suspense
          fallback={
            <div className="flex min-h-[40vh] items-center justify-center text-slate-500 text-sm">Loading…</div>
          }
        >
          <SetupWizardInner />
        </Suspense>
      </div>
    </PermissionGuard>
  );
}
