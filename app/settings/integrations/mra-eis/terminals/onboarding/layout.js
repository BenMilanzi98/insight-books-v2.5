import { tt } from '@/lib/i18n/runtime';
import { Suspense } from 'react';

export default function OnboardingLayout({ children }) {
  return <Suspense fallback={<div className="p-8 text-slate-600">{tt('Loading onboarding…')}</div>}>{children}</Suspense>;
}
