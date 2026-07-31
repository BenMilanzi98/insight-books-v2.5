'use client';

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
        Customer Training
      </h1>
      <p style={{ color: '#555', marginBottom: '1.25rem' }}>
        Phase 22 / PRD 22 (tree phase-18 alias) — Overview, My Work, calendar,
        queues, requests, programs, reports. No fake dashboard. Reliability gate
        never invents zeroes. Handoff ≠ Request ≠ Program. Progress ≠ quality ≠
        completion; completion ≠ adoption.
      </p>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Queues</h2>
        <ul style={{ lineHeight: 1.8, columns: 2, maxWidth: 640 }}>
          <li>New requests</li>
          <li>Scheduling</li>
          <li>In progress</li>
          <li>At risk / blocked</li>
          <li>Assessment / completion</li>
          <li>Certificates</li>
        </ul>
        <p style={{ fontSize: '0.875rem', color: '#777' }}>
          Thin placeholder — card counts not loaded on this hub (
          <code>UNAVAILABLE</code> / null). Server metrics via{' '}
          <code>getTrainingOverviewCards</code> gate fail → UNAVAILABLE / null
          (never invents zeroes).
        </p>
      </section>

      <ul style={{ lineHeight: 1.8 }}>
        <li>
          <Link href="/insightbooks/customer-success/training/my-work">My Work</Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/training/queues">Queues</Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/training/calendar">Calendar</Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/training/at-risk">At-Risk</Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/training/completion">
            Completion workspace
          </Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/training/requests">
            Training Requests
          </Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/training/programs">
            Training Programs
          </Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/training/reports">Reports</Link>
        </li>
        <li>
          <Link href="/insightbooks/customer-success/training/team">Team</Link>
        </li>
      </ul>
    </div>
  );
}
