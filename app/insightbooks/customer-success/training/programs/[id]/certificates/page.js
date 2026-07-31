'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function TrainingProgramCertificatesTab() {
  const { id } = useParams() || {};
  return (
    <div style={{ padding: '1.5rem', maxWidth: 960 }}>
      <p>
        <Link href={`/insightbooks/customer-success/training/programs/${id}`}>
          ← Program
        </Link>
      </p>
      <h1 style={{ fontSize: '1.25rem' }}>Certificates</h1>
      <p style={{ color: '#555' }}>
        Requires ParticipantCompletion. Checksummed (IB-TRN-CERT). Not professional
        accreditation. Revoke → verification REVOKED.
      </p>
    </div>
  );
}
