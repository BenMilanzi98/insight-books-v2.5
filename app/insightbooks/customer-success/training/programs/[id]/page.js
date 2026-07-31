'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import TrainingContextBar from '@/components/admin/customerSuccess/TrainingContextBar';

/**
 * Phase 18 Wave 4 — Program detail tabs (thin but real).
 */
export default function CustomerSuccessTrainingProgramDetailPage() {
  const params = useParams();
  const id = params?.id || '';
  const base = `/insightbooks/customer-success/training/programs/${id}`;

  return (
    <div style={{ padding: '1.5rem', maxWidth: 960 }}>
      <p style={{ marginBottom: '0.75rem' }}>
        <Link href="/insightbooks/customer-success/training/programs">← Programs</Link>
      </p>
      <TrainingContextBar population="training-program-detail" />
      <h1 style={{ fontSize: '1.35rem', marginBottom: '0.5rem' }}>
        Training Program
      </h1>
      <p style={{ color: '#555', marginBottom: '1rem' }}>
        Program <code>{id}</code>. Wave 4 hubs + Wave 3 completion/certs. Phase 17 feed does
        not auto-complete onboarding. Recording / rich banks remain optional gaps.
      </p>
      <ul style={{ lineHeight: 1.8, columns: 2, maxWidth: 720 }}>
        <li>
          <Link href={`${base}/cohorts`}>Cohorts</Link>
        </li>
        <li>
          <Link href={`${base}/participants`}>Participants</Link>
        </li>
        <li>
          <Link href={`${base}/trainers`}>Trainers</Link>
        </li>
        <li>
          <Link href={`${base}/sessions`}>Sessions</Link>
        </li>
        <li>
          <Link href={`${base}/attendance`}>Attendance</Link>
        </li>
        <li>
          <Link href={`${base}/exercises`}>Exercises</Link>
        </li>
        <li>
          <Link href={`${base}/assessments`}>Assessments</Link>
        </li>
        <li>
          <Link href={`${base}/completion`}>Completion</Link>
        </li>
        <li>
          <Link href={`${base}/certificates`}>Certificates</Link>
        </li>
        <li>
          <Link href={`${base}/materials`}>Materials</Link>
        </li>
        <li>
          <Link href={`${base}/environment`}>Environment</Link>
        </li>
      </ul>
    </div>
  );
}
