"use client";
import { tt } from '@/lib/i18n/runtime';

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import PermissionGuard from "@/components/PermissionGuard";
import BusinessSetupWizard from "@/components/setup/BusinessSetupWizard";

function SetupPageInner() {
  const searchParams = useSearchParams();
  const runId = searchParams.get("runId");
  const [initialRun, setInitialRun] = useState(null);
  const [bootstrapped, setBootstrapped] = useState(!runId);

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/setup/runs/${runId}`, { credentials: "include" });
        const json = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) setInitialRun(json.run);
      } finally {
        if (!cancelled) setBootstrapped(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  if (!bootstrapped) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
        {tt('Opening setup…')}
      </div>
    );
  }

  return <BusinessSetupWizard initialRun={initialRun} />;
}

export default function SetupWizardPage() {
  return (
    <PermissionGuard permission="settings.view">
      <div className="w-full">
        <Suspense
          fallback={
            <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
              {tt('Loading…')}
            </div>
          }
        >
          <SetupPageInner />
        </Suspense>
      </div>
    </PermissionGuard>
  );
}
