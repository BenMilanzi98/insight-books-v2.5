"use client";
import { tt } from '@/lib/i18n/runtime';

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Loader2,
  Save,
  AlertTriangle,
} from "lucide-react";
import { SETUP_STEP_STATUS } from "@/lib/setupWizard/constants";
import SetupDomainLinesForm from "@/components/setup/SetupDomainLinesForm";

const FOUNDATION_STEPS = new Set(["profile", "ownership", "calendar"]);
const LINE_STEPS = new Set([
  "paymentAccounts",
  "openingReceivables",
  "openingPayables",
  "openingStock",
  "fixedAssets",
  "otherAssets",
  "liabilitiesLoans",
  "taxes",
  "capitalEquity",
  "manualBalances",
]);
const REVIEW_STEPS = new Set(["trialBalance", "reconciliation", "approval", "posting"]);

function statusIcon(status) {
  if (
    [
      SETUP_STEP_STATUS.COMPLETED,
      SETUP_STEP_STATUS.SKIPPED_OPTIONAL,
      SETUP_STEP_STATUS.POSTED,
    ].includes(status)
  ) {
    return <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />;
  }
  if (status === SETUP_STEP_STATUS.BLOCKED) {
    return <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />;
  }
  return <Circle className="h-4 w-4 text-slate-300" aria-hidden />;
}

export default function BusinessSetupWizard({ initialRun = null }) {
  const [run, setRun] = useState(initialRun);
  const [loading, setLoading] = useState(!initialRun);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [classification, setClassification] = useState(null);
  const [form, setForm] = useState({});
  const [preview, setPreview] = useState(null);
  const [conversionApproved, setConversionApproved] = useState(false);

  const steps = run?.steps || [];
  const defs = run?.stepDefs || [];
  const currentStepId = run?.currentStepId || "profile";
  const currentDef = defs.find((d) => d.id === currentStepId) || defs[0];
  const percent = run?.progress?.completionPercent ?? run?.completionPercent ?? 0;

  const loadActive = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/setup/runs?classify=1", { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.message || json.error || "Could not load setup.");
        return;
      }
      setRun(json.run);
      setClassification(json.classification);
      if (json.run) {
        const step = json.run.steps?.find((s) => s.stepId === json.run.currentStepId);
        setForm(step?.payload && typeof step.payload === "object" ? { ...step.payload } : {});
      }
    } catch {
      setError("Could not load setup.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialRun) loadActive();
    else {
      const step = initialRun.steps?.find((s) => s.stepId === initialRun.currentStepId);
      setForm(step?.payload && typeof step.payload === "object" ? { ...step.payload } : {});
    }
  }, [initialRun, loadActive]);

  const startSetup = async () => {
    setSaving(true);
    setError("");
    try {
      const needsConversion = [
        "EXISTING_WITH_FINANCIAL_ACTIVITY",
        "EXISTING_SETUP_COMPLETED",
        "REQUIRES_CONTROLLED_CONVERSION",
      ].includes(classification?.classification);

      const res = await fetch("/api/setup/runs", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setupType: needsConversion ? "EXISTING_BUSINESS_CONVERSION" : "NEW_BUSINESS",
          conversionApproved: needsConversion ? conversionApproved : false,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.message || json.error || "Could not start setup.");
        return;
      }
      setRun(json.run);
      setForm({});
    } catch {
      setError("Could not start setup.");
    } finally {
      setSaving(false);
    }
  };

  const selectStep = (stepId) => {
    if (!run) return;
    const step = steps.find((s) => s.stepId === stepId);
    setRun((prev) => (prev ? { ...prev, currentStepId: stepId } : prev));
    setForm(step?.payload && typeof step.payload === "object" ? { ...step.payload } : {});
    setError("");
    setMessage("");
    setPreview(null);
  };

  const saveCurrent = async ({ markComplete = false, nextStepId = null, skipOptional = false } = {}) => {
    if (!run || !currentStepId) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const status = skipOptional
        ? SETUP_STEP_STATUS.SKIPPED_OPTIONAL
        : markComplete
          ? SETUP_STEP_STATUS.COMPLETED
          : SETUP_STEP_STATUS.IN_PROGRESS;

      const res = await fetch(`/api/setup/runs/${run.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stepId: currentStepId,
          payload: form,
          status,
          expectedDraftVersion: run.draftVersion,
          currentStepId: nextStepId || currentStepId,
          openingBalanceDate: form.openingBalanceDate,
          cutoverDate: form.cutoverDate,
          baseCurrency: form.baseCurrency,
          timezone: form.timezone,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.message || json.error || "Save failed.");
        if (json.error === "BUSINESS_SETUP_VERSION_CONFLICT") await loadActive();
        return;
      }
      setRun(json.run);
      setMessage("Saved.");
      if (nextStepId) {
        const step = json.run.steps?.find((s) => s.stepId === nextStepId);
        setForm(step?.payload && typeof step.payload === "object" ? { ...step.payload } : {});
      } else {
        const step = json.run.steps?.find((s) => s.stepId === currentStepId);
        setForm(step?.payload && typeof step.payload === "object" ? { ...step.payload } : form);
      }
    } catch {
      setError("Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (action, body = {}) => {
    if (!run) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/setup/runs/${run.id}/${action}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.message || json.error || `${action} failed.`);
        return;
      }
      if (json.run) setRun(json.run);
      if (json.idempotent) setMessage("Already posted — returned existing opening journal.");
      else setMessage(`${action} succeeded.`);
      if (action === "post" && json.run) setRun(json.run);
    } catch {
      setError(`${action} failed.`);
    } finally {
      setSaving(false);
    }
  };

  const loadPreview = async () => {
    if (!run) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/setup/runs/${run.id}/validate`, { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.message || json.error || "Validation failed.");
        return;
      }
      setPreview(json.preview);
    } catch {
      setError("Validation failed.");
    } finally {
      setSaving(false);
    }
  };

  const stepIndex = useMemo(
    () => defs.findIndex((d) => d.id === currentStepId),
    [defs, currentStepId]
  );
  const nextDef = stepIndex >= 0 ? defs[stepIndex + 1] : null;
  const prevDef = stepIndex > 0 ? defs[stepIndex - 1] : null;
  const currentMeta = defs.find((d) => d.id === currentStepId);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        {tt('Loading business setup…')}
      </div>
    );
  }

  if (!run) {
    const needsConversion = [
      "EXISTING_WITH_FINANCIAL_ACTIVITY",
      "EXISTING_SETUP_COMPLETED",
      "REQUIRES_CONTROLLED_CONVERSION",
    ].includes(classification?.classification);

    return (
      <div className="mx-auto max-w-xl space-y-6 px-4 py-10">
        <div>
          <p className="text-sm font-medium text-slate-500">{tt('InsightBooks')}</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">{tt('Business Setup Wizard')}</h1>
          <p className="mt-2 text-sm text-slate-600">
            Configure profile, calendar, accounts, and opening balances. Final posting creates one
            consolidated Opening Journal through the Accounting engine.
          </p>
        </div>
        {classification && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm" role="status">
            <p className="font-medium text-slate-800">
              Business status: {classification.classification}
            </p>
            <p className="mt-1 text-slate-600">{classification.reason}</p>
          </div>
        )}
        {needsConversion && (
          <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <input
              type="checkbox"
              className="mt-1"
              checked={conversionApproved}
              onChange={(e) => setConversionApproved(e.target.checked)}
            />
            <span>
              {tt('I confirm controlled conversion mode: backup acknowledged, Finance approval obtained, and I will not duplicate existing opening balances.')}
            </span>
          </label>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={startSetup}
            disabled={saving || (needsConversion && !conversionApproved)}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Start setup
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700"
          >
            {tt('Back to dashboard')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 px-3 py-4 sm:px-6 lg:flex-row lg:py-8">
      <aside className="w-full shrink-0 rounded-xl border border-slate-200 bg-white p-3 lg:w-72" aria-label={tt('Setup steps')}>
        <div className="mb-3 border-b border-slate-100 pb-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{tt('Setup progress')}</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{percent}%</p>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full bg-slate-800 transition-all" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            v{run.setupVersion} · {String(run.status).replaceAll("_", " ")}
          </p>
        </div>
        <nav className="max-h-[50vh] space-y-1 overflow-y-auto lg:max-h-[70vh]">
          {defs.map((def) => {
            const step = steps.find((s) => s.stepId === def.id);
            const active = def.id === currentStepId;
            return (
              <button
                key={def.id}
                type="button"
                onClick={() => selectStep(def.id)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm ${
                  active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"
                }`}
                aria-current={active ? "step" : undefined}
              >
                {statusIcon(step?.status)}
                <span className="truncate">{def.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{currentDef?.label || "Setup"}</h1>
            <p className="mt-1 text-sm text-slate-600">
              Step {Math.max(stepIndex + 1, 1)} of {defs.length || 23}
            </p>
          </div>
          <Link href="/dashboard" className="text-sm text-slate-600 hover:underline">
            Save &amp; exit
          </Link>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">
            {message}
          </div>
        )}

        <StepBody
          stepId={currentStepId}
          form={form}
          setForm={setForm}
          preview={preview}
          loadPreview={loadPreview}
          runAction={runAction}
          run={run}
          saving={saving}
        />

        <div className="sticky bottom-0 mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white pt-4">
          <button
            type="button"
            disabled={!prevDef || saving}
            onClick={() => prevDef && selectStep(prevDef.id)}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" /> {tt('Previous')}
          </button>
          <div className="flex flex-wrap gap-2">
            {currentMeta?.optional ? (
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  saveCurrent({
                    skipOptional: true,
                    nextStepId: nextDef?.id || currentStepId,
                  })
                }
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                {tt('Skip optional')}
              </button>
            ) : null}
            {!REVIEW_STEPS.has(currentStepId) ? (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => saveCurrent({ markComplete: false })}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    saveCurrent({
                      markComplete: true,
                      nextStepId: nextDef?.id || currentStepId,
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                >
                  Save &amp; continue <ArrowRight className="h-4 w-4" />
                </button>
              </>
            ) : (
              nextDef && (
                <button
                  type="button"
                  onClick={() => selectStep(nextDef.id)}
                  className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                >
                  {tt('Next')} <ArrowRight className="h-4 w-4" />
                </button>
              )
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function StepBody({ stepId, form, setForm, preview, loadPreview, runAction, run, saving }) {
  if (FOUNDATION_STEPS.has(stepId) || stepId === "customers" || stepId === "suppliers" || stepId === "inventoryItems" || stepId === "documents") {
    return <FoundationAndMasterForms stepId={stepId} form={form} setForm={setForm} />;
  }

  if (stepId === "chartOfAccounts") {
    return (
      <div className="space-y-3 text-sm text-slate-700">
        <p>
          {tt('Save this step to apply/ensure the default Chart of Accounts for this business. Account sample and count are stored on the step payload.')}
        </p>
        {form.accountCount != null ? (
          <p className="rounded-lg bg-slate-50 p-3">
            {tt('Active accounts:')} <strong>{form.accountCount}</strong>
          </p>
        ) : (
          <p className="text-slate-500">{tt('Not generated yet — click Save.')}</p>
        )}
      </div>
    );
  }

  if (stepId === "accountMappings") {
    const mappings = form.mappings || {};
    const setMapping = (key, value) =>
      setForm((prev) => ({
        ...prev,
        mappings: { ...(prev.mappings || {}), [key]: value },
      }));
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          {tt('Map system purposes to posting accounts. Saving auto-resolves Opening Balance Equity and common controls when possible.')}
        </p>
        {[
          "OPENING_BALANCE_EQUITY",
          "ACCOUNTS_RECEIVABLE_CONTROL",
          "ACCOUNTS_PAYABLE_CONTROL",
          "INVENTORY_ASSET",
        ].map((key) => (
          <label key={key} className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">{key}</span>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              value={mappings[key] || ""}
              onChange={(e) => setMapping(key, e.target.value)}
              placeholder={tt('Account id')}
            />
          </label>
        ))}
        {Array.isArray(form.mappingIssues) && form.mappingIssues.length > 0 ? (
          <p className="text-sm text-amber-700">Unresolved: {form.mappingIssues.join(", ")}</p>
        ) : null}
      </div>
    );
  }

  if (LINE_STEPS.has(stepId)) {
    return (
      <SetupDomainLinesForm
        form={form}
        setForm={setForm}
        showCustomer={stepId === "openingReceivables"}
        showSupplier={stepId === "openingPayables"}
        help={lineHelp(stepId)}
      />
    );
  }

  if (REVIEW_STEPS.has(stepId) || stepId === "documents") {
    return (
      <ReviewPanel
        stepId={stepId}
        preview={preview}
        loadPreview={loadPreview}
        runAction={runAction}
        run={run}
        saving={saving}
      />
    );
  }

  return (
    <p className="text-sm text-slate-600">Complete this step using Save &amp; continue.</p>
  );
}

function lineHelp(stepId) {
  const map = {
    paymentAccounts:
      "Debit cash/bank/mobile-money asset accounts; credit Opening Balance Equity or Capital.",
    openingReceivables:
      "Debit Accounts Receivable (with customer id); credit Opening Balance Equity — not Revenue.",
    openingPayables:
      "Credit Accounts Payable (with supplier id); debit Opening Balance Equity — not Expense.",
    openingStock: "Debit Inventory Asset; credit Opening Balance Equity — not COGS/Expense.",
    fixedAssets:
      "Debit asset cost; credit Opening Balance Equity. Accumulated depreciation is a credit line.",
    otherAssets: "Debit other asset accounts; credit balancing equity/conversion account.",
    liabilitiesLoans: "Credit loan/liability accounts; debit Opening Balance Equity — not Revenue.",
    taxes: "Credit tax liabilities (or debit tax recoverable); balance via equity/conversion.",
    capitalEquity: "Credit capital / share capital / retained earnings as applicable.",
    manualBalances: "Only for accounts not covered by subledger steps. Do not duplicate controls.",
  };
  return map[stepId] || "";
}

function FoundationAndMasterForms({ stepId, form, setForm }) {
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  if (stepId === "profile") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Legal business name" value={form.legalName || ""} onChange={(v) => set("legalName", v)} />
        <Field label="Trading name" value={form.tradingName || ""} onChange={(v) => set("tradingName", v)} />
        <Field label="Base currency" value={form.baseCurrency || ""} onChange={(v) => set("baseCurrency", v)} placeholder="MWK" />
        <Field label="Timezone" value={form.timezone || ""} onChange={(v) => set("timezone", v)} placeholder={tt('Africa/Blantyre')} />
        <Field label="Country" value={form.country || ""} onChange={(v) => set("country", v)} />
        <Field label="Phone" value={form.businessPhone || ""} onChange={(v) => set("businessPhone", v)} />
        <Field label="Email" value={form.businessEmail || ""} onChange={(v) => set("businessEmail", v)} />
        <Field label="Industry" value={form.industry || ""} onChange={(v) => set("industry", v)} />
      </div>
    );
  }

  if (stepId === "ownership") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">{tt('Legal structure')}</span>
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            value={form.legalStructure || ""}
            onChange={(e) => set("legalStructure", e.target.value)}
          >
            <option value="">{tt('Select…')}</option>
            <option value="SOLE_PROPRIETORSHIP">{tt('Sole proprietorship')}</option>
            <option value="PARTNERSHIP">{tt('Partnership')}</option>
            <option value="PRIVATE_COMPANY">{tt('Private company')}</option>
            <option value="PUBLIC_COMPANY">{tt('Public company')}</option>
            <option value="NON_PROFIT">{tt('Non-profit')}</option>
            <option value="OTHER">{tt('Other')}</option>
          </select>
        </label>
        <Field label="Primary owner name" value={form.primaryOwnerName || ""} onChange={(v) => set("primaryOwnerName", v)} />
        <Field label="Ownership %" value={form.ownershipPercent || ""} onChange={(v) => set("ownershipPercent", v)} />
        <p className="sm:col-span-2 text-xs text-slate-500">
          Ownership does not create capital balances automatically — enter capital in the Capital &amp;
          equity step.
        </p>
      </div>
    );
  }

  if (stepId === "calendar") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Opening balance date"
          type="date"
          value={(form.openingBalanceDate || "").toString().slice(0, 10)}
          onChange={(v) => set("openingBalanceDate", v)}
          help="Date the opening financial position is recognized."
        />
        <Field
          label="Cutover date"
          type="date"
          value={(form.cutoverDate || "").toString().slice(0, 10)}
          onChange={(v) => set("cutoverDate", v)}
          help="First day normal InsightBooks transactions begin."
        />
        <Field
          label="Fiscal year start month"
          value={form.fiscalYearStartMonth || ""}
          onChange={(v) => set("fiscalYearStartMonth", v)}
          placeholder="1–12"
        />
      </div>
    );
  }

  if (stepId === "customers" || stepId === "suppliers" || stepId === "inventoryItems") {
    return (
      <div className="space-y-3 text-sm text-slate-700">
        <p>
          Manage master data in the existing modules, then return here and mark this step complete.
          Opening balances are entered in the following financial steps — creating a customer,
          supplier, or item alone does not post money.
        </p>
        <div className="flex flex-wrap gap-2">
          {stepId === "customers" && (
            <Link className="rounded-md border px-3 py-2 hover:bg-slate-50" href="/clients">
              {tt('Open clients')}
            </Link>
          )}
          {stepId === "suppliers" && (
            <Link className="rounded-md border px-3 py-2 hover:bg-slate-50" href="/suppliers">
              {tt('Open suppliers')}
            </Link>
          )}
          {stepId === "inventoryItems" && (
            <Link className="rounded-md border px-3 py-2 hover:bg-slate-50" href="/stock">
              {tt('Open stock')}
            </Link>
          )}
        </div>
        <Field
          label="Notes"
          value={form.notes || ""}
          onChange={(v) => set("notes", v)}
          placeholder={tt('Optional setup notes')}
        />
      </div>
    );
  }

  if (stepId === "documents") {
    return (
      <div className="space-y-3 text-sm text-slate-700">
        <p>
          Record evidence references for this setup run (bank statements, stock counts, prior trial
          balance). Secure file vault upload lands in a later hardening pass — store references now.
        </p>
        <Field
          label="Evidence reference"
          value={form.evidenceReference || ""}
          onChange={(v) => set("evidenceReference", v)}
          placeholder={tt('e.g. TB-2025-12 / BOX-A')}
        />
        <Field
          label="Document index notes"
          value={form.notes || ""}
          onChange={(v) => set("notes", v)}
        />
      </div>
    );
  }

  return null;
}

function ReviewPanel({ stepId, preview, loadPreview, runAction, run, saving }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={loadPreview}
          className="rounded-md border border-slate-300 px-3 py-2"
        >
          {saving ? "Working…" : "Run Trial Balance & reconciliations"}
        </button>
        {stepId === "approval" || stepId === "posting" ? (
          <>
            <button
              type="button"
              disabled={saving}
              onClick={() => runAction("submit")}
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              {tt('Submit for review')}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => runAction("approve")}
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              {tt('Approve')}
            </button>
            <button
              type="button"
              disabled={saving || run.status !== "APPROVED"}
              onClick={() => runAction("post")}
              className="rounded-md bg-slate-900 px-3 py-2 font-medium text-white disabled:opacity-40"
            >
              {tt('Post opening journal')}
            </button>
          </>
        ) : null}
        {run.status === "COMPLETED" || run.status === "COMPLETED_WITH_WARNINGS" ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              const reason = window.prompt("Reopen reason (required)");
              if (reason) runAction("reopen-request", { reason });
            }}
            className="rounded-md border border-amber-300 px-3 py-2 text-amber-900"
          >
            {tt('Request reopen')}
          </button>
        ) : null}
        {run.status === "REOPEN_REQUESTED" ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => runAction("reopen-approve")}
            className="rounded-md border border-amber-300 px-3 py-2"
          >
            Approve reopen (new version)
          </button>
        ) : null}
      </div>

      {!preview ? (
        <p className="text-slate-500">{tt('Run validation to preview the consolidated Opening Journal.')}</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Total debits" value={preview.compiled?.totals?.debit} />
            <Stat label="Total credits" value={preview.compiled?.totals?.credit} />
            <Stat label="TB difference" value={preview.compiled?.totals?.difference} />
            <Stat
              label="A − L − E"
              value={preview.equation?.difference}
              warn={!preview.equation?.balanced}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Assets" value={preview.equation?.totalAssets} />
            <Stat label="Liabilities" value={preview.equation?.totalLiabilities} />
            <Stat label="Equity" value={preview.equation?.totalEquity} />
          </div>
          {preview.blockers?.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="font-medium text-red-900">{tt('Blockers')}</p>
              <ul className="mt-2 list-disc pl-5 text-red-800">
                {preview.blockers.map((b, i) => (
                  <li key={i}>{b.message}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-2 py-2">{tt('Code')}</th>
                  <th className="px-2 py-2">{tt('Account')}</th>
                  <th className="px-2 py-2">{tt('Step')}</th>
                  <th className="px-2 py-2 text-right">{tt('Debit')}</th>
                  <th className="px-2 py-2 text-right">{tt('Credit')}</th>
                </tr>
              </thead>
              <tbody>
                {(preview.compiled?.lines || []).map((line, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-2 py-1.5">{line.accountCode}</td>
                    <td className="px-2 py-1.5">{line.accountName}</td>
                    <td className="px-2 py-1.5">{line.sourceStepId}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{line.debit || ""}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{line.credit || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-slate-800">{tt('Reconciliations')}</p>
            {(preview.reconciliations?.results || []).map((r) => (
              <div
                key={r.control}
                className={`rounded-md border px-3 py-2 ${
                  r.status === "FAILED"
                    ? "border-red-200 bg-red-50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <span className="font-medium">{r.control}</span> — {r.status} (sub {r.subledger} /
                GL {r.generalLedger})
              </div>
            ))}
          </div>
          {run.journalEntryId ? (
            <p className="text-emerald-800">
              {tt('Posted journal:')} <strong>{run.journalEntryId}</strong>
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, warn }) {
  return (
    <div className={`rounded-lg border p-3 ${warn ? "border-red-300 bg-red-50" : "border-slate-200"}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{value ?? "—"}</p>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, help }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      <input
        type={type}
        className="w-full rounded-md border border-slate-300 px-3 py-2"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {help ? <span className="mt-1 block text-xs text-slate-500">{help}</span> : null}
    </label>
  );
}
