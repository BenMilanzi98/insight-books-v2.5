'use client';
import { tt } from '@/lib/i18n/runtime';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import OnboardingContextBar from '@/components/admin/customerSuccess/OnboardingContextBar';

/**
 * Phase 17 Wave 4 — Project detail with full tab nav + context bar.
 */
export default function OnboardingProjectDetailPage() {
  const params = useParams();
  const id = params?.id || '';
  const base = `/insightbooks/customer-success/onboarding/projects/${id}`;

  const tabs = [
    ['Overview', base],
    ['Source', `${base}/source`],
    ['Kick-off', `${base}/kick-off`],
    ['Stakeholders', `${base}/stakeholders`],
    ['Requirements', `${base}/requirements`],
    ['Tasks', `${base}/tasks`],
    ['Readiness', `${base}/readiness`],
    ['Migration', `${base}/migration`],
    ['Training', `${base}/training`],
    ['Testing', `${base}/testing`],
    ['Go-live', `${base}/go-live`],
    ['Stabilisation', `${base}/stabilisation`],
    ['Handover', `${base}/handover`],
    ['Completion', `${base}/completion`],
    ['Reconciliation', `${base}/reconciliation`],
    ['Audit', `${base}/audit`],
  ];

  return (
    <div style={{ padding: '1.5rem', maxWidth: 960 }}>
      <p>
        <Link href="/insightbooks/customer-success/onboarding/projects">← Projects</Link>
      </p>
      <OnboardingContextBar population={`onboarding-project:${id}`} />
      <h1 style={{ fontSize: '1.35rem', margin: '0.5rem 0' }}>{tt('Onboarding Project')}</h1>
      <p style={{ color: '#555', marginBottom: '1rem' }}>
        {tt('Project')} <code>{id}</code> — Wave 4 detail. Progress ≠ completion. Gate fail →
        UNAVAILABLE. No Tenant GL from onboarding.
      </p>
      <nav
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1.25rem',
        }}
      >
        {tabs.map(([label, href]) => (
          <Link key={href} href={href}>
            {label}
          </Link>
        ))}
      </nav>
      <p style={{ fontSize: '0.875rem', color: '#777' }}>
        {tt('Lineage: commercial → handoff → request → project → evidence → certificate.')}
      </p>
    </div>
  );
}
