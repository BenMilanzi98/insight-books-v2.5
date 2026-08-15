'use client';
import { tt } from '@/lib/i18n/runtime';

import Link from 'next/link';
import TrainingContextBar from '@/components/admin/customerSuccess/TrainingContextBar';

/**
 * Phase 22 Wave 4 — Training Overview hub (thin but real).
 * Thin placeholder queues — card counts not loaded on this client page.
 * Metrics API getTrainingOverviewCards gates to UNAVAILABLE / null when called.
 * No fake dashboard — never invents zeroes.
 */
export default function CustomerSuccessTrainingPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 960 }}>
      <TrainingContextBar
        population="training-overview"
        permissionScope="customerSuccess.read"
      />
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
        {tt('Customer Training')}
      </h1>
      <p style={{ color: '#555', marginBottom: '1.25rem' }}>
        Phase 22 / PRD 22 (tree phase-18 alias) — Overview, My Work, calendar,
        queues, requests, programs, reports. No fake dashboard. Reliability gate
        never invents zeroes. Handoff ≠ Request ≠ Program. Progress ≠ quality ≠
        completion; completion ≠ adoption.
      </p>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{tt('Queues')}</h2>
        <ul style={{ lineHeight: 1.8, columns: 2, maxWidth: 640 }}>
          <li>{tt('New requests')}</li>
          <li>{tt('Scheduling')}</li>
          <li>{tt('In progress')}</li>
          <li>{tt('At risk / blocked')}</li>
          <li>{tt('Assessment / completion')}</li>
          <li>{tt('Certificates')}</li>
        </ul>
        <p style={{ fontSize: '0.875rem', color: '#777' }}>
          Thin placeholder — card counts not loaded on this hub (
          <code>UNAVAILABLE</code> / null). Server metrics via{' '}
          <code>{tt('getTrainingOverviewCards')}</code> gate fail → UNAVAILABLE / null
          (never invents zeroes).
        </p>
      </section>

      <ul style={{ lineHeight: 1.8 }}>
        <li>
          <Link href="/insightbooks/customer-success/training/my-work">{tt('My Work')}</Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/training/queues">{tt('Queues')}</Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/training/calendar">{tt('Calendar')}</Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/training/at-risk">{tt('At-Risk')}</Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/training/completion">
            {tt('Completion workspace')}
          </Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/training/requests">
            {tt('Training Requests')}
          </Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/training/programs">
            {tt('Training Programs')}
          </Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/training/reports">{tt('Reports')}</Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/training/team">{tt('Team')}</Link>
        </li>
      </ul>
    </div>
  );
}
