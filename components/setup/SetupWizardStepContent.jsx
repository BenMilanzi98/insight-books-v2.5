"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  WizardExistingList,
  WizardField,
  WizardFormError,
  WizardStepLoading,
  WizardSubmitButton,
  inputCls,
  selectCls,
} from "@/components/setup/wizardUi";

/**
 * Inline setup forms — all actions stay inside the wizard modal.
 * @param {{ stepId: string, facts: Record<string, unknown>|null, onSaved: () => void|Promise<void>, onError: (msg: string|null) => void }} props
 */
export default function SetupWizardStepContent({ stepId, facts, onSaved, onError }) {
  switch (stepId) {
    case "accountSettings":
      return <AccountSettingsStep facts={facts} onSaved={onSaved} onError={onError} />;
    case "inventory":
    case "openingStock":
      return <OpeningStockStep onSaved={onSaved} onError={onError} />;
    case "customers":
    case "clients":
      return <ClientsStep onSaved={onSaved} onError={onError} />;
    case "suppliers":
      return <SuppliersStep onSaved={onSaved} onError={onError} />;
    case "openingBalances":
    case "openingBalancesReview":
      return <OpeningPaymentBalancesStep facts={facts} onSaved={onSaved} onError={onError} />;
    default:
      return null;
  }
}

function useGlSubtree(root) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/chart-of-accounts/gl-subtree?root=${root}`, {
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) setAccounts(data.accounts || []);
      } catch {
        if (!cancelled) setAccounts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [root]);
  return { accounts, loading };
}

async function postTypedOpeningBalance(payload) {
  const res = await fetch("/api/opening-balances", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Opening balance posting failed");
  return data;
}

function StartingDateStep({ facts, onSaved, onError }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/opening-balances", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && data.startingDate) {
          setDate(new Date(data.startingDate).toISOString().slice(0, 10));
        }
      } catch {
        /* keep default */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    onError(null);
    setLocalError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/opening-balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "setStartingDate", asOfDate: date }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save starting date");
      await onSaved();
    } catch (err) {
      const msg = err.message || "Save failed";
      setLocalError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Set the date your books begin. Opening stock, cash, receivables, and bulk COA entries will use this as-of date.
      </p>
      <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <WizardFormError message={localError} />
        <WizardField label="Starting date *" hint="Usually the first day of your fiscal year or migration date.">
          <input
            type="date"
            className={inputCls}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </WizardField>
        <WizardSubmitButton saving={saving}>
          {facts?.hasStartingDate ? "Update starting date" : "Set starting date"}
        </WizardSubmitButton>
      </form>
    </div>
  );
}

function OpeningBalancesReviewStep({ facts, onSaved, onError }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/opening-balances", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!cancelled) {
          if (res.ok) setReport(data);
          else setLocalError(data.error || "Could not load opening balance summary");
        }
      } catch {
        if (!cancelled) setLocalError("Could not load opening balance summary");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <WizardStepLoading />;

  const s = report?.summary;
  const fmt = (n) =>
    Number(n || 0).toLocaleString("en-MW", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <WizardFormError message={localError} />
      {s?.locked ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Opening balances are locked (an accounting period has been closed).
        </p>
      ) : null}
      {s ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-600">Starting date</span>
            <span className="font-medium">
              {s.startingDate ? new Date(s.startingDate).toLocaleDateString() : "Not set"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Opening stock</span>
            <span>MWK {fmt(s.stockTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Payment accounts</span>
            <span>MWK {fmt(s.paymentAccountsTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Receivables</span>
            <span>MWK {fmt(s.receivablesTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Payables</span>
            <span>MWK {fmt(s.payablesTotal)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-2 font-medium">
            <span>Opening Balance Equity (3190)</span>
            <span>MWK {fmt(s.equityAccount?.balance)}</span>
          </div>
          <p className="text-xs text-slate-500 pt-1">
            {s.journalCount} posted opening journal(s). Use Financial Setup → Opening Balances for bulk COA entry or export.
          </p>
        </div>
      ) : (
        <p className="text-sm text-slate-600">
          No opening balance journals yet. Complete earlier steps or enter balances in Financial Setup.
        </p>
      )}
      <a
        href="/financial-setup/opening-balances"
        className="inline-flex text-sm font-medium text-indigo-600 hover:text-indigo-800"
      >
        Open bulk opening balances →
      </a>
    </div>
  );
}

function CapitalStep({ facts, onSaved, onError }) {
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState(null);
  const configured = facts?.capitalConfigured;

  const submit = async (e) => {
    e.preventDefault();
    onError(null);
    setLocalError(null);
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      setLocalError("Enter a valid opening capital amount.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/capital-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ initialBalance: parsed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to set capital");
      setAmount("");
      await onSaved();
    } catch (err) {
      const msg = err.message || "Save failed";
      setLocalError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {configured ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Owner&apos;s capital is linked to GL 3100. You can record another contribution below if needed.
        </p>
      ) : (
        <p className="text-sm text-slate-600">
          Record opening owner&apos;s capital — debits cash (1110) and credits equity under 3100.
        </p>
      )}
      <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <WizardFormError message={localError} />
        <WizardField label="Opening capital amount (MWK)" hint="Amount the owner invested to start the business.">
          <input
            type="number"
            min="0"
            step="0.01"
            className={inputCls}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 500000"
            required
          />
        </WizardField>
        <WizardSubmitButton saving={saving}>
          {configured ? "Record contribution" : "Set opening capital"}
        </WizardSubmitButton>
      </form>
    </div>
  );
}

function AssetsStep({ onSaved, onError }) {
  const [items, setItems] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const { accounts: glAccounts, loading: glLoading } = useGlSubtree("1500");
  const [form, setForm] = useState({
    name: "",
    purchaseDate: new Date().toISOString().slice(0, 10),
    originalCost: "",
    usefulLifeYears: "5",
    newCategoryName: "Equipment",
    glAccountId: "",
  });
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState(null);

  const load = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/assets?limit=20", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setItems(data.assets || data.data || []);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (glAccounts.length && !form.glAccountId) {
      const preferred =
        glAccounts.find((a) => String(a.accountCode).startsWith("1540")) ||
        glAccounts.find((a) => String(a.accountCode).startsWith("1510")) ||
        glAccounts[0];
      if (preferred) setForm((f) => ({ ...f, glAccountId: preferred.id }));
    }
  }, [glAccounts, form.glAccountId]);

  const submit = async (e) => {
    e.preventDefault();
    onError(null);
    setLocalError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name.trim(),
          purchaseDate: form.purchaseDate,
          originalCost: parseFloat(form.originalCost),
          usefulLifeYears: parseInt(form.usefulLifeYears, 10) || 5,
          newCategoryName: form.newCategoryName.trim() || "Equipment",
          glAccountId: form.glAccountId,
          isExistingAsset: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to add asset");
      setForm((f) => ({ ...f, name: "", originalCost: "" }));
      await load();
      await onSaved();
    } catch (err) {
      const msg = err.message || "Save failed";
      setLocalError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loadingList && glLoading) return <WizardStepLoading />;

  return (
    <div className="space-y-4">
      <WizardExistingList
        title="Registered assets"
        items={items}
        emptyText="No assets yet — add your first one below."
        renderItem={(a) => (
          <span>
            <span className="font-medium">{a.name}</span>
            {a.originalCost != null ? (
              <span className="text-slate-500"> · MWK {Number(a.originalCost).toLocaleString()}</span>
            ) : null}
          </span>
        )}
      />
      <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <WizardFormError message={localError} />
        <div className="grid gap-3 sm:grid-cols-2">
          <WizardField label="Asset name *">
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Company vehicle"
              required
            />
          </WizardField>
          <WizardField label="Purchase date *">
            <input
              type="date"
              className={inputCls}
              value={form.purchaseDate}
              onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
              required
            />
          </WizardField>
          <WizardField label="Original cost (MWK) *">
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputCls}
              value={form.originalCost}
              onChange={(e) => setForm({ ...form, originalCost: e.target.value })}
              required
            />
          </WizardField>
          <WizardField label="Useful life (years) *">
            <input
              type="number"
              min="1"
              className={inputCls}
              value={form.usefulLifeYears}
              onChange={(e) => setForm({ ...form, usefulLifeYears: e.target.value })}
              required
            />
          </WizardField>
          <WizardField label="Category">
            <input
              className={inputCls}
              value={form.newCategoryName}
              onChange={(e) => setForm({ ...form, newCategoryName: e.target.value })}
            />
          </WizardField>
          <WizardField label="GL account (1500 fixed assets) *">
            <select
              className={selectCls}
              value={form.glAccountId}
              onChange={(e) => setForm({ ...form, glAccountId: e.target.value })}
              required
            >
              <option value="">Select account…</option>
              {glAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.accountCode} — {a.accountName || a.name}
                </option>
              ))}
            </select>
          </WizardField>
        </div>
        <WizardSubmitButton saving={saving}>Add asset</WizardSubmitButton>
      </form>
    </div>
  );
}

function LiabilitiesStep({ onSaved, onError }) {
  const [items, setItems] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const { accounts: glAccounts, loading: glLoading } = useGlSubtree("2000");
  const [form, setForm] = useState({
    name: "",
    liabilityType: "loan",
    principalAmount: "",
    startDate: new Date().toISOString().slice(0, 10),
    newCategoryName: "Loans",
    glAccountId: "",
  });
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState(null);

  const load = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/liabilities?limit=20", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setItems(data.liabilities || data.data || []);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (glAccounts.length && !form.glAccountId) {
      const preferred =
        glAccounts.find((a) => String(a.accountCode).startsWith("2510")) ||
        glAccounts.find((a) => String(a.accountCode).startsWith("2160")) ||
        glAccounts[0];
      if (preferred) setForm((f) => ({ ...f, glAccountId: preferred.id }));
    }
  }, [glAccounts, form.glAccountId]);

  const submit = async (e) => {
    e.preventDefault();
    onError(null);
    setLocalError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/liabilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name.trim(),
          liabilityType: form.liabilityType,
          principalAmount: parseFloat(form.principalAmount),
          startDate: form.startDate,
          newCategoryName: form.newCategoryName.trim() || "Loans",
          glAccountId: form.glAccountId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to add liability");
      setForm((f) => ({ ...f, name: "", principalAmount: "" }));
      await load();
      await onSaved();
    } catch (err) {
      const msg = err.message || "Save failed";
      setLocalError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loadingList && glLoading) return <WizardStepLoading />;

  return (
    <div className="space-y-4">
      <WizardExistingList
        title="Tracked liabilities"
        items={items}
        emptyText="No liabilities yet — add a loan or obligation below."
        renderItem={(l) => (
          <span>
            <span className="font-medium">{l.name}</span>
            {l.principalAmount != null ? (
              <span className="text-slate-500"> · MWK {Number(l.principalAmount).toLocaleString()}</span>
            ) : null}
          </span>
        )}
      />
      <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <WizardFormError message={localError} />
        <div className="grid gap-3 sm:grid-cols-2">
          <WizardField label="Name *">
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Bank loan — NBM"
              required
            />
          </WizardField>
          <WizardField label="Type *">
            <select
              className={selectCls}
              value={form.liabilityType}
              onChange={(e) => setForm({ ...form, liabilityType: e.target.value })}
            >
              <option value="loan">Loan</option>
              <option value="hire_purchase">Hire purchase</option>
              <option value="other">Other</option>
            </select>
          </WizardField>
          <WizardField label="Principal amount (MWK) *">
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputCls}
              value={form.principalAmount}
              onChange={(e) => setForm({ ...form, principalAmount: e.target.value })}
              required
            />
          </WizardField>
          <WizardField label="Start date *">
            <input
              type="date"
              className={inputCls}
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              required
            />
          </WizardField>
          <WizardField label="Category">
            <input
              className={inputCls}
              value={form.newCategoryName}
              onChange={(e) => setForm({ ...form, newCategoryName: e.target.value })}
            />
          </WizardField>
          <WizardField label="GL account (2000 liabilities) *">
            <select
              className={selectCls}
              value={form.glAccountId}
              onChange={(e) => setForm({ ...form, glAccountId: e.target.value })}
              required
            >
              <option value="">Select account…</option>
              {glAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.accountCode} — {a.accountName || a.name}
                </option>
              ))}
            </select>
          </WizardField>
        </div>
        <WizardSubmitButton saving={saving}>Add liability</WizardSubmitButton>
      </form>
    </div>
  );
}

function PaymentAccountsStep({ onSaved, onError }) {
  const [items, setItems] = useState([]);
  const [catalog, setCatalog] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [form, setForm] = useState({
    name: "",
    accountType: "Cash",
    parentGlCode: "",
    reference: "",
    openingBalance: "",
  });
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState(null);

  const needsChannel = useMemo(
    () => form.accountType !== "Cash" && ["Bank", "Mobile Money", "Wallet", "POS Terminal"].includes(form.accountType),
    [form.accountType]
  );

  const channelOptions = useMemo(() => {
    if (form.accountType === "Mobile Money") return catalog?.mobile || [];
    if (form.accountType === "Cash") return [];
    return catalog?.banks || [];
  }, [form.accountType, catalog]);

  const load = useCallback(async () => {
    setLoadingList(true);
    try {
      const [accRes, chRes] = await Promise.all([
        fetch("/api/payment-accounts?activeOnly=true", { credentials: "include" }),
        fetch("/api/payment-accounts/channels", { credentials: "include" }),
      ]);
      const accData = await accRes.json().catch(() => ({}));
      const chData = await chRes.json().catch(() => ({}));
      if (accRes.ok) setItems(accData.paymentAccounts || []);
      if (chRes.ok) setCatalog(chData.catalog || null);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (needsChannel && channelOptions.length && !form.parentGlCode) {
      setForm((f) => ({ ...f, parentGlCode: channelOptions[0].code }));
    }
  }, [needsChannel, channelOptions, form.parentGlCode]);

  const submit = async (e) => {
    e.preventDefault();
    onError(null);
    setLocalError(null);
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        accountType: form.accountType,
        reference: form.reference.trim() || undefined,
      };
      if (needsChannel && form.parentGlCode) body.parentGlCode = form.parentGlCode;
      const res = await fetch("/api/payment-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to add payment account");
      const openingAmt = parseFloat(form.openingBalance);
      const coaId = data.paymentAccount?.coaAccountId;
      if (openingAmt > 0 && coaId) {
        try {
          await postTypedOpeningBalance({
            type: "opening_payment_account",
            accountId: coaId,
            entityId: data.paymentAccount?.id,
            amount: openingAmt,
            description: `Opening balance — ${form.name.trim()}`,
            metadata: { paymentAccountId: data.paymentAccount?.id },
          });
        } catch (obErr) {
          console.warn("Payment account opening balance:", obErr.message);
        }
      }
      setForm({ name: "", accountType: "Cash", parentGlCode: "", reference: "", openingBalance: "" });
      await load();
      await onSaved();
    } catch (err) {
      const msg = err.message || "Save failed";
      setLocalError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loadingList) return <WizardStepLoading />;

  return (
    <div className="space-y-4">
      <WizardExistingList
        title="Payment accounts"
        items={items}
        emptyText="No payment accounts — add cash, bank, or mobile money below."
        renderItem={(p) => (
          <span>
            <span className="font-medium">{p.name}</span>
            <span className="text-slate-500">
              {" "}
              · {p.accountType}
              {p.reference ? ` · ${p.reference}` : ""}
            </span>
          </span>
        )}
      />
      <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <WizardFormError message={localError} />
        <div className="grid gap-3 sm:grid-cols-2">
          <WizardField label="Display name *">
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Main cash / NBM operations"
              required
            />
          </WizardField>
          <WizardField label="Type *">
            <select
              className={selectCls}
              value={form.accountType}
              onChange={(e) =>
                setForm({ ...form, accountType: e.target.value, parentGlCode: "" })
              }
            >
              <option value="Cash">Cash</option>
              <option value="Bank">Bank</option>
              <option value="Mobile Money">Mobile Money</option>
              <option value="Wallet">Wallet</option>
              <option value="POS Terminal">POS Terminal</option>
            </select>
          </WizardField>
          {needsChannel ? (
            <WizardField label="Bank / mobile channel *">
              <select
                className={selectCls}
                value={form.parentGlCode}
                onChange={(e) => setForm({ ...form, parentGlCode: e.target.value })}
                required
              >
                <option value="">Select channel…</option>
                {channelOptions.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </WizardField>
          ) : null}
          <WizardField label="Account number (optional)">
            <input
              className={inputCls}
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              placeholder="Bank account no."
            />
          </WizardField>
          <WizardField label="Opening balance (optional)" hint="Cash/bank balance on your starting date — posts Dr asset / Cr 3190.">
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputCls}
              value={form.openingBalance}
              onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
              placeholder="0.00"
            />
          </WizardField>
        </div>
        <WizardSubmitButton saving={saving}>Add payment account</WizardSubmitButton>
      </form>
    </div>
  );
}

function TaxesStep({ facts, onSaved, onError }) {
  const [syncing, setSyncing] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [lastMessage, setLastMessage] = useState(null);

  const sync = async () => {
    onError(null);
    setLocalError(null);
    setSyncing(true);
    try {
      await fetch("/api/settings/tax-defaults", { method: "GET", credentials: "include" });
      const res = await fetch("/api/tax-types/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to sync tax catalog");
      setLastMessage(data.message || "Malawi MRA tax catalog synced.");
      await onSaved();
    } catch (err) {
      const msg = err.message || "Sync failed";
      setLocalError(msg);
      onError(msg);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      {facts?.taxConfigured ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Tax GL accounts (2041 / 2045) and {facts.taxTypeCount} active tax type
          {facts.taxTypeCount === 1 ? "" : "s"} are configured.
        </p>
      ) : (
        <p className="text-sm text-slate-600">
          Sync the Malawi MRA tax catalog — creates tax types and GL child accounts under 2041 and 2045.
        </p>
      )}
      <WizardFormError message={localError} />
      {lastMessage ? (
        <p className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
          {lastMessage}
        </p>
      ) : null}
      <button
        type="button"
        disabled={syncing}
        onClick={sync}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 px-5 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
      >
        {syncing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Syncing…
          </>
        ) : (
          "Sync MRA tax catalog"
        )}
      </button>
    </div>
  );
}

function ClientsStep({ onSaved, onError }) {
  const [items, setItems] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", phone: "", openingReceivable: "" });
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState(null);

  const load = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/clients?limit=20", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setItems(data.clients || []);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    onError(null);
    setLocalError(null);
    if (!form.name.trim()) {
      setLocalError("Client name is required.");
      return;
    }
    setSaving(true);
    try {
      const { openingReceivable, ...clientBody } = form;
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(clientBody),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to add client");
      const openingAmt = parseFloat(openingReceivable);
      if (openingAmt > 0 && data.client?.id) {
        try {
          await postTypedOpeningBalance({
            type: "opening_receivable",
            entityId: data.client.id,
            amount: openingAmt,
            description: `Opening receivable — ${form.name.trim()}`,
            metadata: { clientId: data.client.id },
          });
        } catch (obErr) {
          console.warn("Client opening receivable:", obErr.message);
        }
      }
      setForm({ name: "", email: "", phone: "", openingReceivable: "" });
      await load();
      await onSaved();
    } catch (err) {
      const msg = err.message || "Save failed";
      setLocalError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loadingList) return <WizardStepLoading />;

  return (
    <div className="space-y-4">
      <WizardExistingList
        title="Clients"
        items={items}
        emptyText="No clients yet."
        renderItem={(c) => (
          <span>
            <span className="font-medium">{c.name}</span>
            {c.phone ? <span className="text-slate-500"> · {c.phone}</span> : null}
          </span>
        )}
      />
      <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <WizardFormError message={localError} />
        <div className="grid gap-3 sm:grid-cols-2">
          <WizardField label="Name *">
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </WizardField>
          <WizardField label="Phone">
            <input
              className={inputCls}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </WizardField>
          <WizardField label="Email">
            <input
              type="email"
              className={inputCls}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </WizardField>
          <WizardField label="Opening receivable (optional)" hint="Outstanding customer balance on starting date — posts Dr A/R / Cr 3190.">
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputCls}
              value={form.openingReceivable}
              onChange={(e) => setForm({ ...form, openingReceivable: e.target.value })}
              placeholder="0.00"
            />
          </WizardField>
        </div>
        <WizardSubmitButton saving={saving}>Add client</WizardSubmitButton>
      </form>
      <ClientBulkUpload onSaved={onSaved} onError={onError} />
    </div>
  );
}

function ClientBulkUpload({ onSaved, onError }) {
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setSaving(true);
    setLocalError(null);
    onError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("batchName", `Wizard-Clients-${Date.now()}`);
      const res = await fetch("/api/clients/bulk-upload", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Client import failed");
      setFile(null);
      await onSaved();
    } catch (err) {
      const msg = err.message || "Import failed";
      setLocalError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-dashed border-rose-200 bg-rose-50/40 p-4">
      <p className="text-sm font-semibold text-rose-900">Bulk upload</p>
      <a href="/api/clients/template" className="text-xs font-medium text-rose-800 underline">
        Download CSV template
      </a>
      <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm" />
      <WizardFormError message={localError} />
      <WizardSubmitButton saving={saving} disabled={!file}>
        Import customers
      </WizardSubmitButton>
    </form>
  );
}

function SuppliersStep({ onSaved, onError }) {
  const [items, setItems] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [form, setForm] = useState({ supplierName: "", contactPerson: "", phone: "", openingPayable: "" });
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState(null);

  const load = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/purchases/suppliers?limit=20", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setItems(data.suppliers || data.data || []);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    onError(null);
    setLocalError(null);
    if (!form.supplierName.trim()) {
      setLocalError("Supplier name is required.");
      return;
    }
    setSaving(true);
    try {
      const { openingPayable, ...supplierBody } = form;
      const res = await fetch("/api/purchases/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(supplierBody),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to add supplier");
      const openingAmt = parseFloat(openingPayable);
      if (openingAmt > 0 && data.supplier?.id) {
        try {
          await postTypedOpeningBalance({
            type: "opening_payable",
            entityId: data.supplier.id,
            amount: openingAmt,
            description: `Opening payable — ${form.supplierName.trim()}`,
            metadata: { supplierId: data.supplier.id },
          });
        } catch (obErr) {
          console.warn("Supplier opening payable:", obErr.message);
        }
      }
      setForm({ supplierName: "", contactPerson: "", phone: "", openingPayable: "" });
      await load();
      await onSaved();
    } catch (err) {
      const msg = err.message || "Save failed";
      setLocalError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loadingList) return <WizardStepLoading />;

  return (
    <div className="space-y-4">
      <WizardExistingList
        title="Suppliers"
        items={items}
        emptyText="No suppliers yet."
        renderItem={(s) => (
          <span>
            <span className="font-medium">{s.supplierName || s.name}</span>
            {s.phone ? <span className="text-slate-500"> · {s.phone}</span> : null}
          </span>
        )}
      />
      <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <WizardFormError message={localError} />
        <div className="grid gap-3 sm:grid-cols-2">
          <WizardField label="Supplier name *">
            <input
              className={inputCls}
              value={form.supplierName}
              onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
              required
            />
          </WizardField>
          <WizardField label="Contact person">
            <input
              className={inputCls}
              value={form.contactPerson}
              onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
            />
          </WizardField>
          <WizardField label="Phone">
            <input
              className={inputCls}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </WizardField>
          <WizardField label="Opening payable (optional)" hint="Amount owed to supplier on starting date — posts Dr 3190 / Cr A/P.">
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputCls}
              value={form.openingPayable}
              onChange={(e) => setForm({ ...form, openingPayable: e.target.value })}
              placeholder="0.00"
            />
          </WizardField>
        </div>
        <WizardSubmitButton saving={saving}>Add supplier</WizardSubmitButton>
      </form>
      <SupplierBulkUpload onSaved={async () => { await load(); await onSaved(); }} onError={onError} />
    </div>
  );
}

function SupplierBulkUpload({ onSaved, onError }) {
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setSaving(true);
    setLocalError(null);
    onError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/purchases/suppliers/bulk-upload", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || data.message || "Supplier import failed");
      }
      setFile(null);
      await onSaved();
    } catch (err) {
      const msg = err.message || "Import failed";
      setLocalError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-dashed border-lime-200 bg-lime-50/40 p-4">
      <p className="text-sm font-semibold text-lime-900">Bulk upload</p>
      <a href="/api/purchases/suppliers/template" className="text-xs font-medium text-lime-800 underline">
        Download CSV template
      </a>
      <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm" />
      <WizardFormError message={localError} />
      <WizardSubmitButton saving={saving} disabled={!file}>
        Import suppliers
      </WizardSubmitButton>
    </form>
  );
}

function OpeningStockStep({ onSaved, onError }) {
  const [items, setItems] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [mode, setMode] = useState("new");
  const [form, setForm] = useState({ name: "", quantityInStock: "", costPrice: "" });
  const [stockIn, setStockIn] = useState({ productId: "", quantity: "", unitCost: "" });
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState(null);

  const load = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/stock?catalog=products&limit=50", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      const list = data.products || data.inventory || data.data || [];
      if (res.ok) setItems(Array.isArray(list) ? list : []);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submitNew = async (e) => {
    e.preventDefault();
    onError(null);
    setLocalError(null);
    const qty = parseFloat(form.quantityInStock);
    const cost = parseFloat(form.costPrice);
    if (!form.name.trim() || Number.isNaN(qty) || qty < 0 || Number.isNaN(cost) || cost < 0) {
      setLocalError("Product name, quantity, and unit cost are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name.trim(),
          quantityInStock: qty,
          costPrice: cost,
          isService: false,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to add product");
      setForm({ name: "", quantityInStock: "", costPrice: "" });
      await load();
      await onSaved();
    } catch (err) {
      const msg = err.message || "Save failed";
      setLocalError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  };

  const submitStockIn = async (e) => {
    e.preventDefault();
    onError(null);
    setLocalError(null);
    const qty = parseFloat(stockIn.quantity);
    if (!stockIn.productId || Number.isNaN(qty) || qty <= 0) {
      setLocalError("Select a product and enter a valid quantity.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        productId: stockIn.productId,
        type: "Stock In",
        quantity: qty,
      };
      if (stockIn.unitCost) body.unitCost = parseFloat(stockIn.unitCost);
      const res = await fetch("/api/stock/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Stock In failed");
      setStockIn({ productId: "", quantity: "", unitCost: "" });
      await load();
      await onSaved();
    } catch (err) {
      const msg = err.message || "Save failed";
      setLocalError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loadingList) return <WizardStepLoading />;

  const stocked = items.filter((p) => Number(p.stockLevel ?? p.quantityInStock ?? 0) > 0);

  return (
    <div className="space-y-4">
      <WizardExistingList
        title="Products with stock"
        items={stocked}
        emptyText="No opening stock recorded yet."
        renderItem={(p) => (
          <span>
            <span className="font-medium">{p.name}</span>
            <span className="text-slate-500">
              {" "}
              · qty {Number(p.stockLevel ?? p.quantityInStock ?? 0)}
            </span>
          </span>
        )}
      />
      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setMode("new")}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold ${mode === "new" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
        >
          New product
        </button>
        <button
          type="button"
          onClick={() => setMode("stockIn")}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold ${mode === "stockIn" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
        >
          Stock In (existing)
        </button>
      </div>
      <WizardFormError message={localError} />
      {mode === "new" ? (
        <form onSubmit={submitNew} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <WizardField label="Product name *">
              <input
                className={inputCls}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </WizardField>
            <WizardField label="Opening quantity *">
              <input
                type="number"
                min="0"
                step="any"
                className={inputCls}
                value={form.quantityInStock}
                onChange={(e) => setForm({ ...form, quantityInStock: e.target.value })}
                required
              />
            </WizardField>
            <WizardField label="Unit cost (MWK) *">
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputCls}
                value={form.costPrice}
                onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                required
              />
            </WizardField>
          </div>
          <WizardSubmitButton saving={saving}>Add product with opening stock</WizardSubmitButton>
        </form>
      ) : (
        <form onSubmit={submitStockIn} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <WizardField label="Product *">
              <select
                className={selectCls}
                value={stockIn.productId}
                onChange={(e) => setStockIn({ ...stockIn, productId: e.target.value })}
                required
              >
                <option value="">Select product…</option>
                {items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (current: {Number(p.stockLevel ?? p.quantityInStock ?? 0)})
                  </option>
                ))}
              </select>
            </WizardField>
            <WizardField label="Quantity to add *">
              <input
                type="number"
                min="0.0001"
                step="any"
                className={inputCls}
                value={stockIn.quantity}
                onChange={(e) => setStockIn({ ...stockIn, quantity: e.target.value })}
                required
              />
            </WizardField>
            <WizardField label="Unit cost (MWK)">
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputCls}
                value={stockIn.unitCost}
                onChange={(e) => setStockIn({ ...stockIn, unitCost: e.target.value })}
              />
            </WizardField>
          </div>
          <WizardSubmitButton saving={saving}>Record Stock In</WizardSubmitButton>
        </form>
      )}
      <BulkStockUpload onSaved={onSaved} onError={onError} />
    </div>
  );
}

function BulkStockUpload({ onSaved, onError }) {
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState(null);

  const upload = async () => {
    if (!file) return;
    setSaving(true);
    setLocalError(null);
    onError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("purpose", "OPENING_STOCK");
      const preview = await fetch("/api/stock/basic-import/preview", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const previewData = await preview.json().catch(() => ({}));
      if (!preview.ok) throw new Error(previewData.error || "Stock preview failed");
      const confirm = await fetch("/api/stock/basic-import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          batchId: previewData.batchId || previewData.batch?.id,
          purpose: "OPENING_STOCK",
        }),
      });
      const confirmData = await confirm.json().catch(() => ({}));
      if (!confirm.ok) throw new Error(confirmData.error || "Stock import failed");
      setFile(null);
      await onSaved();
    } catch (err) {
      const msg = err.message || "Import failed";
      setLocalError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-dashed border-sky-200 bg-sky-50/50 p-4 space-y-3">
      <p className="text-sm font-semibold text-sky-900">Option A — bulk opening stock</p>
      <div className="flex flex-wrap gap-2">
        <a
          href="/api/stock/basic-import/template"
          className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium text-sky-800"
        >
          Download template
        </a>
      </div>
      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="text-sm"
      />
      <WizardFormError message={localError} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          upload();
        }}
      >
        <WizardSubmitButton saving={saving} disabled={!file}>
          Upload opening stock
        </WizardSubmitButton>
      </form>
    </div>
  );
}

function AccountSettingsStep({ facts, onSaved, onError }) {
  const [form, setForm] = useState({
    name: facts?.tenantName || "",
    businessPhone: facts?.businessPhone || "",
    businessEmail: facts?.businessEmail || "",
    businessAddress: facts?.businessAddress || "",
  });
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    setForm({
      name: facts?.tenantName || "",
      businessPhone: facts?.businessPhone || "",
      businessEmail: facts?.businessEmail || "",
      businessAddress: facts?.businessAddress || "",
    });
  }, [facts]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setLocalError(null);
    onError(null);
    try {
      const res = await fetch("/api/tenant/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save account settings");
      await onSaved();
    } catch (err) {
      const msg = err.message || "Save failed";
      setLocalError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-600">Only fill what is missing. Existing values are prefilled.</p>
      <WizardFormError message={localError} />
      <WizardField label="Business name *">
        <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </WizardField>
      {!facts?.businessPhone && (
        <WizardField label="Phone">
          <input className={inputCls} value={form.businessPhone} onChange={(e) => setForm({ ...form, businessPhone: e.target.value })} />
        </WizardField>
      )}
      {!facts?.businessEmail && (
        <WizardField label="Email">
          <input type="email" className={inputCls} value={form.businessEmail} onChange={(e) => setForm({ ...form, businessEmail: e.target.value })} />
        </WizardField>
      )}
      {!facts?.businessAddress && (
        <WizardField label="Address">
          <input className={inputCls} value={form.businessAddress} onChange={(e) => setForm({ ...form, businessAddress: e.target.value })} />
        </WizardField>
      )}
      <WizardSubmitButton saving={saving}>Save account settings</WizardSubmitButton>
    </form>
  );
}

function OpeningPaymentBalancesStep({ facts, onSaved, onError }) {
  const [accounts, setAccounts] = useState([]);
  const [amounts, setAmounts] = useState({});
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/payment-accounts", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) {
          setAccounts(data.accounts || data.paymentAccounts || data.data || []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setLocalError(null);
    onError(null);
    try {
      let posted = 0;
      for (const account of accounts) {
        const amt = parseFloat(amounts[account.id]);
        if (!(amt > 0) || !account.coaAccountId) continue;
        await postTypedOpeningBalance({
          type: "opening_payment_account",
          accountId: account.coaAccountId,
          amount: amt,
          asOfDate,
          description: `Opening balance — ${account.name}`,
          metadata: { paymentAccountId: account.id },
        });
        posted += 1;
      }
      if (posted === 0 && !facts?.hasOpeningBalancesReview) {
        throw new Error("Enter at least one opening amount for a payment account, or skip this step.");
      }
      await onSaved();
    } catch (err) {
      const msg = err.message || "Posting failed";
      setLocalError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <WizardStepLoading />;

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <WizardFormError message={localError} />
      <WizardField label="As-of date">
        <input type="date" className={inputCls} value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
      </WizardField>
      {!accounts.length ? (
        <p className="text-sm text-slate-600">No payment accounts yet. Add cash/bank accounts in Payment Accounts, then resume this step.</p>
      ) : (
        accounts.map((account) => (
          <WizardField key={account.id} label={`${account.name} (${account.accountType || "Account"})`}>
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputCls}
              placeholder="Leave blank to skip"
              value={amounts[account.id] || ""}
              onChange={(e) => setAmounts((prev) => ({ ...prev, [account.id]: e.target.value }))}
            />
          </WizardField>
        ))
      )}
      <WizardSubmitButton saving={saving}>Post opening balances</WizardSubmitButton>
    </form>
  );
}
