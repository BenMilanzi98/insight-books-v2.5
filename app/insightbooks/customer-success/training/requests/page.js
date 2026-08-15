'use client';
import { tt } from '@/lib/i18n/runtime';

import Link from 'next/link';
import TrainingContextBar from '@/components/admin/customerSuccess/TrainingContextBar';

/**
 * Phase 18 Wave 4 — Training Requests list (thin but real).
 */
export default function CustomerSuccessTrainingRequestsPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 960 }}>
      <p style={{ marginBottom: '0.75rem' }}>
        <Link href="/insightbooks/customer-success/training">← Training</Link>
      </p>
      <TrainingContextBar population="training-requests" />
      <h1 style={{ fontSize: '1.35rem', marginBottom: '0.5rem' }}>
        {tt('Training Requests')}
      </h1>
      <p style={{ color: '#555' }}>
        TRQ-YYYY-###### spine. List is portfolio fail-closed via{' '}
        <code>{tt('listTrainingRequests')}</code>. Handoff ≠ Request ≠ Program.
      </p>
    </div>
  );
}
