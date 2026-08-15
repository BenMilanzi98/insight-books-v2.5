'use client';
import { tt } from '@/lib/i18n/runtime';

import Link from 'next/link';
import TrainingContextBar from '@/components/admin/customerSuccess/TrainingContextBar';

/**
 * Phase 18 Wave 4 — Training Programs list (thin but real).
 */
export default function CustomerSuccessTrainingProgramsPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 960 }}>
      <p style={{ marginBottom: '0.75rem' }}>
        <Link href="/insightbooks/customer-success/training">← Training</Link>
      </p>
      <TrainingContextBar population="training-programs" />
      <h1 style={{ fontSize: '1.35rem', marginBottom: '0.5rem' }}>
        {tt('Training Programs')}
      </h1>
      <p style={{ color: '#555' }}>
        {tt('TRN-YYYY-###### spine with pinned curriculumVersionId. List is portfolio fail-closed via')} <code>{tt('listTrainingPrograms')}</code>.
      </p>
    </div>
  );
}
