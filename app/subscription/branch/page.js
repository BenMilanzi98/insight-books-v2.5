"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SUBSCRIPTION_PLANS_ARRAY } from "@/lib/subscriptionConfig";

function BranchSubscriptionContent() {
  const searchParams = useSearchParams();
  const branchId = searchParams.get("branchId");

  const [branch, setBranch] = useState(null);
  const [loadingBranch, setLoadingBranch] = useState(true);
  const [loadingPay, setLoadingPay] = useState(false);
  const [error, setError] = useState(null);

  const plans = useMemo(() => {
    // keep same plans/pricing as tenant subscription for now
    return SUBSCRIPTION_PLANS_ARRAY.map((p) => ({
      id: p.id,
      name: p.name,
      priceFormatted: p.priceFormatted,
      amount: p.price,
      periodDisplay: p.periodDisplay,
      popular: p.popular,
      features: p.features || [],
    }));
  }, []);

  const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id || "1month");

  useEffect(() => {
    const loadBranch = async () => {
      if (!branchId) {
        setLoadingBranch(false);
        setError("Missing branchId. Please go back and try again.");
        return;
      }
      try {
        setLoadingBranch(true);
        setError(null);
        const res = await fetch(`/api/branches/${encodeURIComponent(branchId)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load branch");
        setBranch(json.branch);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoadingBranch(false);
      }
    };
    loadBranch();
  }, [branchId]);

  const startPayment = async () => {
    try {
      if (!branchId) throw new Error("Missing branchId");
      const plan = plans.find((p) => p.id === selectedPlanId) || plans[0];
      if (!plan) throw new Error("No plan selected");

      setLoadingPay(true);
      setError(null);

      const res = await fetch("/api/subscription/branch/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          plan: plan.id,
          amount: plan.amount,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.checkout_url) {
        throw new Error(json?.error || "Failed to start payment");
      }

      window.location.href = json.checkout_url;
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingPay(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h1 className="text-2xl font-bold text-gray-900">Activate Branch</h1>
        <p className="text-gray-600 mt-2">
          This branch requires its own subscription before it can be used.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        {loadingBranch ? (
          <div className="text-gray-600">Loading branch…</div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm text-gray-500">Branch</div>
              <div className="text-lg font-semibold text-gray-900">
                {branch?.name || "Unknown"}
              </div>
              <div className="text-sm text-gray-500">ID: {branchId}</div>
            </div>
            <div>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  branch?.isActive ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {branch?.isActive ? "Active" : "Inactive (requires payment)"}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div className="text-lg font-semibold text-gray-900">Choose a plan</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plans.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedPlanId(p.id)}
              className={`text-left border rounded-xl p-4 transition ${
                selectedPlanId === p.id
                  ? "border-blue-500 ring-2 ring-blue-100"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold text-gray-900">{p.name}</div>
                {p.popular && (
                  <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                    Popular
                  </span>
                )}
              </div>
              <div className="mt-2 text-gray-700 font-medium">
                {p.priceFormatted} <span className="text-gray-500">{p.periodDisplay}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="pt-2 flex items-center justify-end">
          <button
            type="button"
            disabled={loadingPay || loadingBranch || !branchId}
            onClick={startPayment}
            className={`px-5 py-3 rounded-lg font-semibold text-white ${
              loadingPay ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loadingPay ? "Redirecting…" : "Pay & Activate Branch"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BranchSubscriptionPage() {
  return (
    <Suspense fallback={
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    }>
      <BranchSubscriptionContent />
    </Suspense>
  );
}

