'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function TrainingProgramEnvironmentTab() {
  const { id } = useParams() || {};
  return (
    <div style={{ padding: '1.5rem', maxWidth: 960 }}>
      <p>
        <Link href={`/insightbooks/customer-success/training/programs/${id}`}>
          ← Program
        </Link>
      </p>
      <h1 style={{ fontSize: '1.25rem' }}>Environment</h1>
      <p style={{ color: '#555' }}>
        Isolation assert — no Production Customer data in shared practice environments.
      </p>
    </div>
  );
}
