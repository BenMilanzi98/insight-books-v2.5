"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import PermissionGuard from "@/components/PermissionGuard";

/** Standalone /setup route — redirects owners to the dashboard modal experience. */
function SetupRedirectInner() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
    const t = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("setup-wizard-open"));
    }, 100);
    return () => window.clearTimeout(t);
  }, [router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
      Opening setup wizard…
    </div>
  );
}

export default function SetupWizardPage() {
  return (
    <PermissionGuard permission="settings.view">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 py-8 px-4">
        <Suspense fallback={<div className="text-center text-slate-500">Loading…</div>}>
          <SetupRedirectInner />
        </Suspense>
      </div>
    </PermissionGuard>
  );
}
