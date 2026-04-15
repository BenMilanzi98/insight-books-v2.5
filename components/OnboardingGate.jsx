"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

function shouldSkipOnboarding(pathname) {
  if (!pathname) return true;
  if (pathname === "/" || pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/insightbooks")) return true;
  if (pathname.startsWith("/contact") || pathname.startsWith("/terms") || pathname.startsWith("/privacy"))
    return true;
  if (pathname.startsWith("/ref/") || pathname.startsWith("/affiliate/")) return true;
  if (pathname.startsWith("/download-app")) return true;
  if (pathname === "/suspended") return true;
  if (pathname.startsWith("/subscription")) return true;
  return false;
}

export default function OnboardingGate({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (shouldSkipOnboarding(pathname)) {
        if (!cancelled) setReady(true);
        return;
      }

      try {
        const res = await fetch("/api/tenant/onboarding-status", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) {
          if (!cancelled) setReady(true);
          return;
        }

        if (!data.isTenantOwner) {
          if (!cancelled) setReady(true);
          return;
        }

        if (data.requiresCapital && !pathname.startsWith("/capital-account")) {
          router.replace("/capital-account?onboarding=1");
          return;
        }

        if (
          !data.requiresCapital &&
          data.requiresPayments &&
          !pathname.startsWith("/payments/management")
        ) {
          router.replace("/payments/management?onboarding=1");
          return;
        }
      } catch {
        /* fail-open */
      }
      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!ready && !shouldSkipOnboarding(pathname)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500 text-sm">
        Loading workspace…
      </div>
    );
  }

  return children;
}
