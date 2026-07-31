import { Suspense } from 'react';

export default function OnboardingLayout({ children }) {
  return <Suspense fallback={<div className="p-8 text-slate-600">Loading onboarding…</div>}>{children}</Suspense>;
}
