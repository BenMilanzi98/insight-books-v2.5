"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/shell/PageHeader";
import TaxOpsTable from "@/components/tax/TaxOpsTable";
import TaxSettlementModal from "@/components/TaxSettlementModal";
import { formatCurrency } from "@/lib/currencyUtils";
import { getPermission } from "@/lib/permissions";

export default function TaxPaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [canSettle, setCanSettle] = useState(false);
  const [showSettle, setShowSettle] = useState(false);
  const [message, setMessage] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tax-management/payments");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load payments");
      setPayments(data.payments || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([getPermission("tax.settle"), getPermission("tax.update")]).then(
      ([settle, update]) => setCanSettle(Boolean(settle || update))
    );
    load();
  }, []);

  const onSubmitSettlement = async (settlementData) => {
    const response = await fetch("/api/tax/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settlementData),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Settlement failed");
    setMessage("Tax settlement recorded and added to the payment register.");
    setShowSettle(false);
    await load();
    return body;
  };

  const columns = [
    {
      key: "paymentDate",
      label: "Date",
      render: (r) => new Date(r.paymentDate).toLocaleDateString(),
    },
    {
      key: "period",
      label: "Period",
      render: (r) => r.taxPeriod?.code || "—",
    },
    {
      key: "amount",
      label: "Amount",
      render: (r) => formatCurrency(Number(r.amount || 0)),
    },
    { key: "status", label: "Status" },
    { key: "description", label: "Description" },
    {
      key: "links",
      label: "Links",
      render: (r) => (
        <span className="text-[var(--text-secondary)]">
          {r.expenseId ? `Expense ${r.expenseId.slice(0, 8)}…` : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="container mx-auto py-2">
      <PageHeader
        title="Tax payments"
        description="Settlements post via V2 (Dr tax payable / Cr bank) and dual-write into this register."
        actions={
          canSettle ? (
            <button
              type="button"
              onClick={() => setShowSettle(true)}
              className="rounded-[var(--radius-sm)] bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white"
            >
              Record settlement
            </button>
          ) : null
        }
      />
      <p className="mb-4 text-sm text-[var(--text-secondary)]">
        Account balances remain on{" "}
        <Link href="/tax-management/accounts" className="text-[var(--brand-primary)] hover:underline">
          Tax accounts
        </Link>
        .
      </p>
      {message ? (
        <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      ) : null}
      <TaxOpsTable
        columns={columns}
        rows={payments}
        loading={loading}
        emptyLabel="No tax payments registered yet. Record a settlement to populate this list."
      />
      <TaxSettlementModal
        isOpen={showSettle}
        onClose={() => setShowSettle(false)}
        onSubmit={onSubmitSettlement}
      />
    </div>
  );
}
