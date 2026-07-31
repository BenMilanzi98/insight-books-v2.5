'use client';

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
        Customer Onboarding
      </h1>
      <p style={{ color: '#555', marginBottom: '1.25rem' }}>
        Phase 21 (PRD) / tree-17 — Overview, My Work, queues, requests, projects, reports.
        Reliability gate never invents zeroes. Handoff ≠ Request ≠ Project.
        Progress ≠ readiness ≠ completion; completion ≠ adoption.
      </p>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Queues</h2>
        <ul style={{ lineHeight: 1.8, columns: 2, maxWidth: 640 }}>
          <li>New requests</li>
          <li>Ready for kick-off</li>
          <li>In progress</li>
          <li>At risk / blocked</li>
          <li>Go-live / stabilisation</li>
          <li>Handover / completion</li>
        </ul>
        <p style={{ fontSize: '0.875rem', color: '#777' }}>
          Card counts load via <code>getOnboardingOverviewCards</code> — gate fail →
          UNAVAILABLE / null (never false zero).
        </p>
      </section>

      <ul style={{ lineHeight: 1.8 }}>
        <li>
          <Link href="/insightbooks/customer-success/onboarding/my-work">My Work</Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/onboarding/queues">Queues</Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/onboarding/requests">
            Onboarding Requests
          </Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/onboarding/projects">
            Onboarding Projects
          </Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/onboarding/templates">Templates</Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/onboarding/reports">Reports</Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/onboarding/team">Team</Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/onboarding/calendar">Calendar</Link>
        </li>
      </ul>
    </div>
  );
}
