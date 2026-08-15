'use client';
import { tt } from '@/lib/i18n/runtime';

import Link from 'next/link';
import OnboardingContextBar from '@/components/admin/customerSuccess/OnboardingContextBar';

/** Phase 17 Wave 4 — Templates catalogue UI. */
export default function OnboardingTemplatesPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 720 }}>
      <p>
        <Link href="/insightbooks/customer-success/onboarding">← Onboarding</Link>
      </p>
      <OnboardingContextBar population="onboarding-templates" />
      <h1 style={{ fontSize: '1.35rem', margin: '0.5rem 0' }}>{tt('Templates')}</h1>
      <p style={{ color: '#555' }}>
        {tt('Versioned templates — ACTIVE versions immutable once applied. Approve / activate via API.')}
      </p>
    </div>
  );
}
