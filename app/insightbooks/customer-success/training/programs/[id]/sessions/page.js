'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function TrainingProgramSessionsTab() {
  const { id } = useParams() || {};
  return (
    <div style={{ padding: '1.5rem', maxWidth: 960 }}>
      <p>
        <Link href={`/insightbooks/customer-success/training/programs/${id}`}>
          ← Program
        </Link>
      </p>
      <h1 style={{ fontSize: '1.25rem' }}>Sessions</h1>
      <p style={{ color: '#555' }}>
        TRS-YYYY-###### linked to Phase 13 Meetings. RSVP ≠ attendance. Virtual provider:{' '}
        <code>VIRTUAL_PROVIDER_NOT_CONFIGURED</code>.
      </p>
    </div>
  );
}
