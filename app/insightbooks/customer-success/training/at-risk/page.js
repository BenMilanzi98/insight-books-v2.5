'use client';
import { tt } from '@/lib/i18n/runtime';

import Link from 'next/link';
import TrainingContextBar from '@/components/admin/customerSuccess/TrainingContextBar';

/** Phase 18 Wave 4 — At-Risk queue (thin). */
export default function TrainingAtRiskPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 800 }}>
      <p>
        <Link href="/insightbooks/customer-success/training">← Training</Link>
      </p>
      <TrainingContextBar population="training-at-risk" />
      <h1 style={{ fontSize: '1.35rem', margin: '0.5rem 0' }}>{tt('At-Risk')}</h1>
      <p style={{ color: '#555' }}>
        {tt('Programs in AT_RISK / BLOCKED. Counts via reliability-gated overview cards — never false zero.')}
      </p>
    </div>
  );
}
