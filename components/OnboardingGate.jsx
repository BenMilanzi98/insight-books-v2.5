"use client";
import { tt } from '@/lib/i18n/runtime';

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { DESKTOP_COOKIE } from '@/lib/desktop/runtime';

function isDesktopClient() {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some((part) => {
    const [name, value] = part.trim().split('=');
    return name === DESKTOP_COOKIE && value === '1';
  });
}

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
      if (isDesktopClient()) {
        if (!cancelled) setReady(true);
        return;
      }

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
        {tt('Loading workspace…')}
      </div>
    );
  }

  return children;
}
