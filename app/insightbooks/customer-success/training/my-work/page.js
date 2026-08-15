'use client';
import { tt } from '@/lib/i18n/runtime';

import Link from 'next/link';
import TrainingContextBar from '@/components/admin/customerSuccess/TrainingContextBar';

/** Phase 18 Wave 4 — My Work (owner-scoped; excludes other CS owners). */
export default function TrainingMyWorkPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 800 }}>
      <p>
        <Link href="/insightbooks/customer-success/training">← Training</Link>
      </p>
      <TrainingContextBar
        population="training-my-work"
        permissionScope="customerSuccess.read (owner-scoped)"
      />
      <h1 style={{ fontSize: '1.35rem', margin: '0.5rem 0' }}>{tt('My Work')}</h1>
      <p style={{ color: '#555' }}>
        Programs where you are CS / training owner. Other owners&apos; programs are
        excluded. Counts via <code>{tt('getTrainingMyWork')}</code>.
      </p>
    </div>
  );
}
