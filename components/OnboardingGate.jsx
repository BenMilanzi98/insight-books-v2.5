"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (shouldSkipOnboarding(pathname)) {
        if (!cancelled) setReady(true);
        return;
      }

      try {
        await fetch("/api/tenant/onboarding-status", { credentials: "include" });
        // Setup is optional: dashboard + /setup wizard remind owners; do not hard-redirect here.
      } catch {
        /* fail-open */
      }
      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (!ready && !shouldSkipOnboarding(pathname)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500 text-sm">
        Loading workspace…
      </div>
    );
  }

  return children;
}
