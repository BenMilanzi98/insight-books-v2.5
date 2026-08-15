'use client';
import { tt } from '@/lib/i18n/runtime';

import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function TrainingProgramCompletionTab() {
  const { id } = useParams() || {};
  return (
    <div style={{ padding: '1.5rem', maxWidth: 960 }}>
      <p>
        <Link href={`/insightbooks/customer-success/training/programs/${id}`}>
          ← Program
        </Link>
      </p>
      <h1 style={{ fontSize: '1.25rem' }}>{tt('Completion')}</h1>
      <p style={{ color: '#555' }}>
        Deterministic against versioned policy (attendance + exercises + assessments).
        UNKNOWN ≠ COMPLETED. Training complete ≠ onboarding Project complete.
      </p>
    </div>
  );
}
