"use client";
import { tt } from '@/lib/i18n/runtime';

import { Suspense } from "react";
import CapitalAccountManager from "@/components/CapitalAccountManager";
import { useSearchParams } from "next/navigation";
import PosStylePageHeader from "@/components/shell/PosStylePageHeader";

function CapitalAccountPageInner() {
  const searchParams = useSearchParams();
  const onboarding = searchParams.get("onboarding") === "1";

  return (
    <div className="w-full">
      <PosStylePageHeader
        title="Capital Account Management"
        description="Manage your business capital, set initial balances, and transfer funds between accounts"
      />
      <CapitalAccountManager onboarding={onboarding} />
    </div>
  );
}

export default function CapitalAccountPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">{tt('Loading…')}</div>
      }
    >
      <CapitalAccountPageInner />
    </Suspense>
  );
}
