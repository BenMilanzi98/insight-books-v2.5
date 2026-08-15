'use client';
import { tt } from '@/lib/i18n/runtime';

import Link from 'next/link';
import TrainingContextBar from '@/components/admin/customerSuccess/TrainingContextBar';

/** Phase 18 Wave 4 — Team hub (thin). */
export default function TrainingTeamPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 800 }}>
      <p>
        <Link href="/insightbooks/customer-success/training">← Training</Link>
      </p>
      <TrainingContextBar population="training-team" />
      <h1 style={{ fontSize: '1.35rem', margin: '0.5rem 0' }}>{tt('Team')}</h1>
      <p style={{ color: '#555' }}>
        {tt('Trainer capacity and CS owner assignment overview. Portfolio fail-closed for scoped actors.')}
      </p>
    </div>
  );
}
