'use client';
import { tt } from '@/lib/i18n/runtime';

import Link from 'next/link';
import { useParams } from 'next/navigation';

/** Phase 17 Wave 2 — thin kick-off tab (Phase 13 Meeting; RSVP ≠ attendance). */
export default function OnboardingKickoffTabPage() {
  const params = useParams();
  const id = params?.id || '';

  return (
    <div style={{ padding: '1.5rem', maxWidth: 720 }}>
      <p>
        <Link href={`/insightbooks/customer-success/onboarding/projects/${id}`}>← Project</Link>
      </p>
      <h1 style={{ fontSize: '1.25rem', margin: '1rem 0 0.5rem' }}>{tt('Kick-off')}</h1>
      <p style={{ color: '#555' }}>
        {tt('Schedules / links a Phase 13')} <code>{tt('CrmMeeting')}</code> {tt('once. RSVP accepted is not attendance. Meeting service unavailable →')} <code>{tt('MEETING_SERVICE_UNAVAILABLE')}</code>. Never fabricate
        kick-off complete without Meeting.
      </p>
    </div>
  );
}
