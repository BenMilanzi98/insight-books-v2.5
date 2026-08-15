'use client';
import { tt } from '@/lib/i18n/runtime';

import Link from 'next/link';
import TrainingContextBar from '@/components/admin/customerSuccess/TrainingContextBar';

/** Phase 18 Wave 4 — Training queues (thin). */
export default function TrainingQueuesPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 800 }}>
      <p>
        <Link href="/insightbooks/customer-success/training">← Training</Link>
      </p>
      <TrainingContextBar population="training-queues" />
      <h1 style={{ fontSize: '1.35rem', margin: '0.5rem 0' }}>{tt('Queues')}</h1>
      <p style={{ color: '#555' }}>
        {tt('Today / Upcoming / At-Risk / Completion queues. KPI cards never invent zeroes on reliability gate failure.')}
      </p>
    </div>
  );
}
