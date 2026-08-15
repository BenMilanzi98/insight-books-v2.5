'use client';
import { tt } from '@/lib/i18n/runtime';

import Link from 'next/link';
import TrainingContextBar from '@/components/admin/customerSuccess/TrainingContextBar';

/** Phase 18 Wave 4 — Calendar / Today / Upcoming (thin). */
export default function TrainingCalendarPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 800 }}>
      <p>
        <Link href="/insightbooks/customer-success/training">← Training</Link>
      </p>
      <TrainingContextBar population="training-calendar" />
      <h1 style={{ fontSize: '1.35rem', margin: '0.5rem 0' }}>{tt('Calendar')}</h1>
      <p style={{ color: '#555' }}>
        {tt('Today and Upcoming session views. Calendar Event alone ≠ delivery. Virtual provider remains')} <code>{tt('VIRTUAL_PROVIDER_NOT_CONFIGURED')}</code>.
      </p>
    </div>
  );
}
