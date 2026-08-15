'use client';
import { tt } from '@/lib/i18n/runtime';

import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function TrainingProgramAssessmentsTab() {
  const { id } = useParams() || {};
  return (
    <div style={{ padding: '1.5rem', maxWidth: 960 }}>
      <p>
        <Link href={`/insightbooks/customer-success/training/programs/${id}`}>
          ← Program
        </Link>
      </p>
      <h1 style={{ fontSize: '1.25rem' }}>{tt('Assessments')}</h1>
      <p style={{ color: '#555' }}>
        {tt('Server-authoritative timers and attempt limits. Answers are not shown in list payloads. Final results are immutable without regrade.')}
      </p>
    </div>
  );
}
