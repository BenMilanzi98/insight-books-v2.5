"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calculator, Scale } from "lucide-react";
import TaxCodesManagement from "@/components/tax/TaxCodesManagement";
import TaxAccountsBalances from "@/components/tax/TaxAccountsBalances";

const TABS = [
  { id: "codes", label: "Tax codes", icon: Calculator },
  { id: "balances", label: "Balances", icon: Scale },
];

function TaxAccountsHub() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = tabParam === "balances" ? "balances" : "codes";

  const setTab = useCallback(
    (id) => {
      const next = id === "codes" ? "/tax-management/accounts" : `/tax-management/accounts?tab=${id}`;
      router.replace(next, { scroll: false });
    },
    [router]
  );

  return (
    <div className="w-full">
      <div className="border-b border-gray-200 bg-white px-4 md:px-6">
        <div className="flex gap-1 overflow-x-auto pt-3">
          {TABS.map(({ id, label, icon: Icon }) => {
            const selected = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  selected
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800"
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "codes" ? <TaxCodesManagement /> : <TaxAccountsBalances />}
    </div>
  );
}

export default function TaxManagementAccountsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      }
    >
      <TaxAccountsHub />
    </Suspense>
  );
}
