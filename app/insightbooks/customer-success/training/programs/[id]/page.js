'use client';
import { tt } from '@/lib/i18n/runtime';

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
        {tt('Training Program')}
      </h1>
      <p style={{ color: '#555', marginBottom: '1rem' }}>
        {tt('Program')} <code>{id}</code>. Wave 4 hubs + Wave 3 completion/certs. Phase 17 feed does
        not auto-complete onboarding. Recording / rich banks remain optional gaps.
      </p>
      <ul style={{ lineHeight: 1.8, columns: 2, maxWidth: 720 }}>
        <li>
          <Link href={`${base}/cohorts`}>{tt('Cohorts')}</Link>
        </li>
        <li>
          <Link href={`${base}/participants`}>{tt('Participants')}</Link>
        </li>
        <li>
          <Link href={`${base}/trainers`}>{tt('Trainers')}</Link>
        </li>
        <li>
          <Link href={`${base}/sessions`}>{tt('Sessions')}</Link>
        </li>
        <li>
          <Link href={`${base}/attendance`}>{tt('Attendance')}</Link>
        </li>
        <li>
          <Link href={`${base}/exercises`}>{tt('Exercises')}</Link>
        </li>
        <li>
          <Link href={`${base}/assessments`}>{tt('Assessments')}</Link>
        </li>
        <li>
          <Link href={`${base}/completion`}>{tt('Completion')}</Link>
        </li>
        <li>
          <Link href={`${base}/certificates`}>{tt('Certificates')}</Link>
        </li>
        <li>
          <Link href={`${base}/materials`}>{tt('Materials')}</Link>
        </li>
        <li>
          <Link href={`${base}/environment`}>{tt('Environment')}</Link>
        </li>
      </ul>
    </div>
  );
}
