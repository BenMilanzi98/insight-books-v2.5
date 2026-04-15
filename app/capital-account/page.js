"use client";

import { Suspense } from "react";
import CapitalAccountManager from "@/components/CapitalAccountManager";
import { Wallet } from "lucide-react";
import { useSearchParams } from "next/navigation";

function CapitalAccountPageInner() {
  const searchParams = useSearchParams();
  const onboarding = searchParams.get("onboarding") === "1";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 shadow-xl shadow-indigo-200/50 p-6 sm:p-8 mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
              <Wallet className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Capital Account Management</h1>
              <p className="text-indigo-100 text-sm mt-0.5">
                Manage your business capital, set initial balances, and transfer funds between accounts
              </p>
            </div>
          </div>
        </div>
        <CapitalAccountManager onboarding={onboarding} />
      </div>
    </div>
  );
}

export default function CapitalAccountPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">Loading…</div>
      }
    >
      <CapitalAccountPageInner />
    </Suspense>
  );
}
