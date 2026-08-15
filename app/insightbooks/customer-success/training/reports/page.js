'use client';
import { tt } from '@/lib/i18n/runtime';

import Link from 'next/link';
import TrainingContextBar from '@/components/admin/customerSuccess/TrainingContextBar';

/** Phase 18 Wave 4 — Training reports (thin). */
export default function TrainingReportsPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 800 }}>
      <p>
        <Link href="/insightbooks/customer-success/training">← Training</Link>
      </p>
      <TrainingContextBar population="training-reports" />
      <h1 style={{ fontSize: '1.35rem', margin: '0.5rem 0' }}>{tt('Reports')}</h1>
      <p style={{ color: '#555' }}>
        Overview / At-Risk / Scheduling / Completion / Certificates. Exports strip answers
        and tokens; manage permission rechecked.
      </p>
    </div>
  );
}
