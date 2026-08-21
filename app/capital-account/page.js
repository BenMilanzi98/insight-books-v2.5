"use client";
import { tt } from '@/lib/i18n/runtime';

import { Suspense } from "react";
import CapitalEquityPanel from "@/components/CapitalEquityPanel";
import { useSearchParams } from "next/navigation";

function CapitalAccountPageInner() {
  const searchParams = useSearchParams();
  const onboarding = searchParams.get("onboarding") === "1";

  return <CapitalEquityPanel onboarding={onboarding} />;
}

export default function CapitalAccountPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">
          {tt('Loading…')}
        </div>
      }
    >
      <CapitalAccountPageInner />
    </Suspense>
  );
}
