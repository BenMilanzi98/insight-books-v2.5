'use client';
import { tt } from '@/lib/i18n/runtime';

import Link from 'next/link';
import TrainingContextBar from '@/components/admin/customerSuccess/TrainingContextBar';

/** Phase 18 Wave 4 — Completion workspace (thin). */
export default function TrainingCompletionWorkspacePage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 800 }}>
      <p>
        <Link href="/insightbooks/customer-success/training">← Training</Link>
      </p>
      <TrainingContextBar population="training-completion" />
      <h1 style={{ fontSize: '1.35rem', margin: '0.5rem 0' }}>{tt('Completion')}</h1>
      <p style={{ color: '#555' }}>
        Participant / program completion review and certificate issue. Certificate requires
        completion + checksum; not professional accreditation.
      </p>
    </div>
  );
}
