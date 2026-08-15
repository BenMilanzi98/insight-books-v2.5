'use client';
import { tt } from '@/lib/i18n/runtime';

import Link from 'next/link';
import OnboardingContextBar from '@/components/admin/customerSuccess/OnboardingContextBar';

/**
 * PRD Phase 21 Wave 4 — Onboarding Overview hub (thin but real; tree-17 alias).
 * Reliability-gated cards; queues; AdminShell context bar.
 * No fake dashboards. Progress ≠ readiness ≠ completion; completion ≠ adoption.
 */
export default function CustomerSuccessOnboardingPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 960 }}>
      <OnboardingContextBar
        population="onboarding-overview"
        permissionScope="customerSuccess.read"
      />
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
        {tt('Customer Onboarding')}
      </h1>
      <p style={{ color: '#555', marginBottom: '1.25rem' }}>
        Phase 21 (PRD) / tree-17 — Overview, My Work, queues, requests, projects, reports.
        Reliability gate never invents zeroes. Handoff ≠ Request ≠ Project.
        Progress ≠ readiness ≠ completion; completion ≠ adoption.
      </p>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{tt('Queues')}</h2>
        <ul style={{ lineHeight: 1.8, columns: 2, maxWidth: 640 }}>
          <li>{tt('New requests')}</li>
          <li>{tt('Ready for kick-off')}</li>
          <li>{tt('In progress')}</li>
          <li>{tt('At risk / blocked')}</li>
          <li>{tt('Go-live / stabilisation')}</li>
          <li>{tt('Handover / completion')}</li>
        </ul>
        <p style={{ fontSize: '0.875rem', color: '#777' }}>
          {tt('Card counts load via')} <code>{tt('getOnboardingOverviewCards')}</code> — gate fail →
          UNAVAILABLE / null (never false zero).
        </p>
      </section>

      <ul style={{ lineHeight: 1.8 }}>
        <li>
          <Link href="/insightbooks/customer-success/onboarding/my-work">{tt('My Work')}</Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/onboarding/queues">{tt('Queues')}</Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/onboarding/requests">
            {tt('Onboarding Requests')}
          </Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/onboarding/projects">
            {tt('Onboarding Projects')}
          </Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/onboarding/templates">{tt('Templates')}</Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/onboarding/reports">{tt('Reports')}</Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/onboarding/team">{tt('Team')}</Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/onboarding/calendar">{tt('Calendar')}</Link>
        </li>
      </ul>
    </div>
  );
}
