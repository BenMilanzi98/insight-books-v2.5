'use client';

import Link from 'next/link';
import { CrmStubView } from '@/components/admin';

/**
 * Phase 20 Wave 4 — Conversion Overview hub (thin AdminShell).
 * Reliability-gated cards via getConversionOverview / getConversionMetric.
 * Gate fail → UNAVAILABLE / null (never false zero). Accepted ≠ Revenue.
 */
export default function CrmConversionsOverviewPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 960 }}>
      <CrmStubView
        titleKey="admin-pages.crm.conversionHub.title"
        hintKey="admin-pages.crm.conversionHub.overview"
        emptyTitleKey="admin-pages.crm.conversionsOverview.emptyTitle"
        emptyHintKey="admin-pages.crm.conversionsOverview.emptyHint"
      />
      <p style={{ color: '#555', marginTop: '0.75rem', marginBottom: '1rem' }}>
        Closed-Won / accepted value is never labelled collected or recognised
        Revenue. Reliability gate never invents zeroes.
      </p>
      <section style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Queues</h2>
        <ul style={{ lineHeight: 1.8 }}>
          <li>
            <Link href="/insightbooks/crm/conversions/my-work">My Work</Link>
          </li>
          <li>
            <Link href="/insightbooks/crm/conversions/queues">Queues</Link>
          </li>
          <li>
            <Link href="/insightbooks/crm/conversions/requests">Requests</Link>
          </li>
          <li>
            <Link href="/insightbooks/crm/closed-won">Closed-Won alias</Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
