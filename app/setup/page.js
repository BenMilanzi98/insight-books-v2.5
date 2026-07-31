"use client";

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
        Opening setup…
      </div>
    );
  }

  return <BusinessSetupWizard initialRun={initialRun} />;
}

export default function SetupWizardPage() {
  return (
    <PermissionGuard permission="settings.view">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
        <Suspense
          fallback={
            <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
              Loading…
            </div>
          }
        >
          <SetupPageInner />
        </Suspense>
      </div>
    </PermissionGuard>
  );
}
