'use client';
import { tt } from '@/lib/i18n/runtime';

import Link from 'next/link';
import AdoptionContextBar from '@/components/admin/customerSuccess/AdoptionContextBar';

/**
 * Phase 19 Wave 4 — Adoption Overview hub (thin but real).
 * Reliability-gated cards; queues; AdminShell context bar.
 */
export default function CustomerSuccessAdoptionPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 960 }}>
      <AdoptionContextBar
        population="adoption-overview"
        permissionScope="customerSuccess.read"
      />
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
        {tt('Customer Adoption')}
      </h1>
      <p style={{ color: '#555', marginBottom: '1.25rem' }}>
        Phase 19 Wave 4 — Overview, My Work, Team, Portfolio, Attention/Dormancy,
        Request/Plan lists, reports. Reliability gate never invents zeroes.
        Expansion handoff ≠ renewals execute.
      </p>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{tt('Queues')}</h2>
        <ul style={{ lineHeight: 1.8, columns: 2, maxWidth: 640 }}>
          <li>{tt('New requests')}</li>
          <li>{tt('Active plans')}</li>
          <li>{tt('At risk / churn risk')}</li>
          <li>{tt('Value review')}</li>
          <li>{tt('Dormancy attention')}</li>
          <li>{tt('Expansion handoffs')}</li>
        </ul>
        <p style={{ fontSize: '0.875rem', color: '#777' }}>
          {tt('Card counts load via')} <code>{tt('getAdoptionOverviewCards')}</code> — gate fail →
          UNAVAILABLE / null (never false zero).
        </p>
      </section>

      <ul style={{ lineHeight: 1.8 }}>
        <li>
          <Link href="/insightbooks/customer-success/adoption/my-work">{tt('My Work')}</Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/adoption/team">{tt('Team')}</Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/adoption/portfolio">
            {tt('Portfolio')}
          </Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/adoption/queues">{tt('Queues')}</Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/adoption/attention">
            {tt('Attention / Dormancy')}
          </Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/adoption/requests">
            {tt('Adoption Requests')}
          </Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/adoption/plans">
            {tt('Adoption Plans')}
          </Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/adoption/milestones">
            {tt('Milestones')}
          </Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/adoption/outcomes">
            {tt('Value Outcomes')}
          </Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/adoption/champions">
            {tt('Champions')}
          </Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/adoption/dormancy">
            {tt('Dormancy Recovery')}
          </Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/adoption/expansion">
            {tt('Expansion Handoffs')}
          </Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/adoption/reports">{tt('Reports')}</Link>
        </li>
      </ul>
    </div>
  );
}
