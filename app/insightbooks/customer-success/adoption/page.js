'use client';

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
        Customer Adoption
      </h1>
      <p style={{ color: '#555', marginBottom: '1.25rem' }}>
        Phase 19 Wave 4 — Overview, My Work, Team, Portfolio, Attention/Dormancy,
        Request/Plan lists, reports. Reliability gate never invents zeroes.
        Expansion handoff ≠ renewals execute.
      </p>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Queues</h2>
        <ul style={{ lineHeight: 1.8, columns: 2, maxWidth: 640 }}>
          <li>New requests</li>
          <li>Active plans</li>
          <li>At risk / churn risk</li>
          <li>Value review</li>
          <li>Dormancy attention</li>
          <li>Expansion handoffs</li>
        </ul>
        <p style={{ fontSize: '0.875rem', color: '#777' }}>
          Card counts load via <code>getAdoptionOverviewCards</code> — gate fail →
          UNAVAILABLE / null (never false zero).
        </p>
      </section>

      <ul style={{ lineHeight: 1.8 }}>
        <li>
          <Link href="/insightbooks/customer-success/adoption/my-work">My Work</Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/adoption/team">Team</Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/adoption/portfolio">
            Portfolio
          </Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/adoption/queues">Queues</Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/adoption/attention">
            Attention / Dormancy
          </Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/adoption/requests">
            Adoption Requests
          </Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/adoption/plans">
            Adoption Plans
          </Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/adoption/milestones">
            Milestones
          </Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/adoption/outcomes">
            Value Outcomes
          </Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/adoption/champions">
            Champions
          </Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/adoption/dormancy">
            Dormancy Recovery
          </Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/adoption/expansion">
            Expansion Handoffs
          </Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/adoption/reports">Reports</Link>
        </li>
      </ul>
    </div>
  );
}
