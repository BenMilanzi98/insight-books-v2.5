"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Landmark,
  Smartphone,
  DollarSign,
  ChevronRight,
  Loader,
  X,
  Save,
  Edit2,
  Trash2,
  CreditCard,
} from "lucide-react";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "MWK",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

function ChannelIcon({ accountType, className = "h-5 w-5" }) {
  const t = (accountType || "").toLowerCase();
  if (t === "bank") return <Landmark className={className} strokeWidth={1.75} />;
  if (t === "mobile money") return <Smartphone className={className} strokeWidth={1.75} />;
  if (t === "cash") return <DollarSign className={className} strokeWidth={1.75} />;
  return <CreditCard className={className} strokeWidth={1.75} />;
}

function emptyForm(parentGlCode = "") {
  return {
    name: "",
    accountType: parentGlCode?.startsWith("114") ? "Mobile Money" : "Bank",
    reference: "",
    parentGlCode: parentGlCode || "",
    isActive: true,
  };
}

export function PaymentAccountFormModal({
  open,
  onClose,
  onSaved,
  editingAccount = null,
  defaultParentGlCode = "",
  catalog = null,
}) {
  const [form, setForm] = useState(emptyForm(defaultParentGlCode));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    if (editingAccount) {
      setForm({
        name: editingAccount.name || "",
        accountType: editingAccount.accountType || "Bank",
        reference: editingAccount.reference || "",
        parentGlCode: editingAccount.parentGlCode || defaultParentGlCode || "",
        isActive: editingAccount.isActive !== false,
      });
    } else {
      setForm(emptyForm(defaultParentGlCode));
    }
    setError(null);
  }, [open, editingAccount, defaultParentGlCode]);

  const bankOptions = catalog?.banks || [];
  const mobileOptions = catalog?.mobile || [];
  const needsChannel =
    form.accountType !== "Cash" &&
    ["Bank", "Mobile Money", "Wallet"].includes(form.accountType);

  const channelOptions =
    form.accountType === "Mobile Money"
      ? mobileOptions
      : form.accountType === "Cash"
        ? []
        : bankOptions;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const url = editingAccount
        ? `/api/payment-accounts/${editingAccount.id}`
        : "/api/payment-accounts";
      const method = editingAccount ? "PUT" : "POST";
      const body = {
        name: form.name.trim(),
        accountType: form.accountType,
        reference: form.reference?.trim() || undefined,
        isActive: form.isActive,
      };
      if (needsChannel && form.parentGlCode) {
        body.parentGlCode = form.parentGlCode;
      }
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === "PAYMENT_GL_SLOTS_EXHAUSTED" || data.code === "PAYMENT_PARENT_GL_REQUIRED") {
          throw new Error(data.error || "Could not link GL account");
        }
        throw new Error(data.error || "Failed to save");
      }
      onSaved?.(data.paymentAccount);
      onClose?.();
    } catch (err) {
      setError(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/45">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-900">
            {editingAccount ? "Edit payment account" : "Add payment account"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={submit} className="px-5 py-4 space-y-4">
          {error ? (
            <p className="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
              {error}
            </p>
          ) : null}

          {form.accountType === "Cash" ? (
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600">
              Cash posts to GL <span className="font-mono font-semibold">1110</span> — Cash - Main Account
            </div>
          ) : null}

          {needsChannel && !editingAccount ? (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                Bank / mobile channel *
              </label>
              <select
                required
                value={form.parentGlCode}
                onChange={(e) => setForm((p) => ({ ...p, parentGlCode: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Select channel…</option>
                {channelOptions.map((ch) => (
                  <option key={ch.code} value={ch.code}>
                    {ch.code} — {ch.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-500">
                A GL sub-account (e.g. {form.parentGlCode || "1131"}-01) is created automatically under this parent.
              </p>
            </div>
          ) : null}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Account name *
            </label>
            <input
              type="text"
              required
              disabled={editingAccount?.isSystem}
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
              placeholder="e.g. Operations account"
            />
          </div>

          {!editingAccount ? (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                Type
              </label>
              <select
                value={form.accountType}
                onChange={(e) => {
                  const accountType = e.target.value;
                  setForm((p) => ({
                    ...p,
                    accountType,
                    parentGlCode: accountType === "Mobile Money" ? "1140" : accountType === "Cash" ? "" : p.parentGlCode,
                  }));
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="Bank">Bank</option>
                <option value="Mobile Money">Mobile Money</option>
                <option value="Wallet">Wallet</option>
                <option value="POS Terminal">POS Terminal</option>
              </select>
            </div>
          ) : (
            <div className="text-sm text-slate-600">
              Type: <span className="font-medium text-slate-900">{form.accountType}</span>
              {form.parentGlCode ? (
                <>
                  {" "}
                  · Channel <span className="font-mono text-xs">{form.parentGlCode}</span>
                </>
              ) : null}
              {editingAccount?.coaCode ? (
                <>
                  {" "}
                  · GL <span className="font-mono text-xs">{editingAccount.coaCode}</span>
                </>
              ) : null}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Account number / reference
            </label>
            <input
              type="text"
              value={form.reference}
              onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Shown on the GL sub-account label"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              disabled={editingAccount?.isSystem}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
            />
            Active
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 inline-flex items-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AccountRow({ account, mode, onSelect, onEdit, onDelete }) {
  if (mode === "management") {
    return (
      <div className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg hover:bg-slate-50/80">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900 truncate">{account.name}</p>
          <p className="text-[11px] text-slate-500 font-mono">
            {account.coaCode || "—"}
            {account.reference ? ` · ${account.reference}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm font-semibold tabular-nums text-slate-900">
            {formatCurrency(account.balance)}
          </span>
          {!account.isSystem ? (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => onEdit?.(account)}
                className="p-1.5 rounded-md text-slate-500 hover:text-indigo-700 hover:bg-indigo-50"
                aria-label="Edit"
              >
                <Edit2 size={15} />
              </button>
              <button
                type="button"
                onClick={() => onDelete?.(account)}
                className="p-1.5 rounded-md text-slate-500 hover:text-rose-700 hover:bg-rose-50"
                aria-label="Delete"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ) : (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">System</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect?.(account)}
      className="w-full text-left flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg hover:bg-white/80 transition group"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">{account.name}</p>
        <p className="text-[11px] text-slate-500 font-mono">
          {account.coaCode || "Pending GL"}
          {account.reference ? ` · ${account.reference}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-semibold tabular-nums text-slate-900">
          {formatCurrency(account.balance)}
        </span>
        <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500" />
      </div>
    </button>
  );
}

function ChannelCard({ channel, mode, onAddAccount, onSelectAccount, onEditAccount, onDeleteAccount }) {
  const [open, setOpen] = useState(true);
  const hasAccounts = channel.accounts?.length > 0;

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 py-3.5 bg-slate-50/80 border-b border-slate-100">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <div className="rounded-lg bg-white p-2 text-slate-700 ring-1 ring-slate-200/80 shrink-0">
            <ChannelIcon accountType={channel.accountType} />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-semibold text-slate-500">{channel.code}</p>
            <p className="text-sm font-semibold text-slate-900 leading-snug">{channel.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Rollup total · {channel.accounts?.length || 0} account
              {(channel.accounts?.length || 0) === 1 ? "" : "s"}
            </p>
          </div>
        </button>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold tabular-nums text-slate-900">
            {formatCurrency(channel.totalBalance)}
          </p>
          <button
            type="button"
            onClick={() => onAddAccount?.(channel.code, channel.accountType)}
            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </div>
      {open ? (
        <div className="px-2 py-2 min-h-[3rem]">
          {hasAccounts ? (
            channel.accounts.map((acc) => (
              <AccountRow
                key={acc.id}
                account={acc}
                mode={mode}
                onSelect={onSelectAccount}
                onEdit={onEditAccount}
                onDelete={onDeleteAccount}
              />
            ))
          ) : (
            <p className="text-xs text-slate-400 text-center py-4 px-2">
              No accounts yet — add one under this channel.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function PaymentChannelsPanel({
  mode = "dashboard",
  onSelectAccount,
  onEditAccount,
  onDeleteAccount,
  refreshKey = 0,
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [defaultParentGlCode, setDefaultParentGlCode] = useState("");
  const [editingAccount, setEditingAccount] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payment-accounts/channels");
      const json = await res.json();
      if (res.ok && json.success) setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const bankChannels = useMemo(
    () => (data?.channels || []).filter((c) => c.accountType === "Bank"),
    [data]
  );
  const mobileChannels = useMemo(
    () => (data?.channels || []).filter((c) => c.accountType === "Mobile Money"),
    [data]
  );

  const openAdd = (parentGlCode, accountType) => {
    setEditingAccount(null);
    setDefaultParentGlCode(parentGlCode || "");
    setModalOpen(true);
  };

  const openEdit = (account) => {
    setEditingAccount(account);
    setDefaultParentGlCode(account.parentGlCode || "");
    setModalOpen(true);
    onEditAccount?.(account);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
        <Loader className="h-5 w-5 animate-spin" />
        Loading payment channels…
      </div>
    );
  }

  if (!data) {
    return <p className="text-center py-12 text-sm text-slate-500">Could not load payment channels.</p>;
  }

  return (
    <div className="space-y-8">
      {/* Cash — 1110 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Cash</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              GL {data.cash?.code} — {data.cash?.name}
            </p>
          </div>
          <p className="text-xl font-bold tabular-nums text-slate-900">
            {formatCurrency(data.cash?.totalBalance)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
          {(data.cash?.accounts || []).map((acc) => (
            <AccountRow
              key={acc.id}
              account={acc}
              mode={mode}
              onSelect={onSelectAccount}
              onEdit={openEdit}
              onDelete={onDeleteAccount}
            />
          ))}
        </div>
      </section>

      {/* Banks */}
      <section>
        <div className="mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Banks</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Parent accounts 1131–1138 show accumulated totals. Post to child GL accounts only.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {bankChannels.map((ch) => (
            <ChannelCard
              key={ch.code}
              channel={ch}
              mode={mode}
              onAddAccount={openAdd}
              onSelectAccount={onSelectAccount}
              onEditAccount={openEdit}
              onDeleteAccount={onDeleteAccount}
            />
          ))}
        </div>
      </section>

      {/* Mobile money */}
      <section>
        <div className="mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Mobile money</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mobileChannels.map((ch) => (
            <ChannelCard
              key={ch.code}
              channel={ch}
              mode={mode}
              onAddAccount={openAdd}
              onSelectAccount={onSelectAccount}
              onEditAccount={openEdit}
              onDeleteAccount={onDeleteAccount}
            />
          ))}
        </div>
      </section>

      {data.otherAccounts?.length ? (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">Other</h2>
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
            {data.otherAccounts.map((acc) => (
              <AccountRow
                key={acc.id}
                account={acc}
                mode={mode}
                onSelect={onSelectAccount}
                onEdit={openEdit}
                onDelete={onDeleteAccount}
              />
            ))}
          </div>
        </section>
      ) : null}

      <PaymentAccountFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingAccount(null);
        }}
        editingAccount={editingAccount}
        defaultParentGlCode={defaultParentGlCode}
        catalog={data.catalog}
        onSaved={() => load()}
      />
    </div>
  );
}

export { formatCurrency as formatPaymentCurrency };
