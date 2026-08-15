'use client';
import { tt } from '@/lib/i18n/runtime';

/**
 * Public maintenance page shown when CUTOVER_MODE=maintenance.
 */

export default function MaintenancePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        color: '#e2e8f0',
        fontFamily: 'Georgia, "Times New Roman", serif',
      }}
    >
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <p style={{ letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: 12, color: '#94a3b8' }}>
          {tt('InsightBooks')}
        </p>
        <h1 style={{ fontSize: '2rem', margin: '0.75rem 0' }}>{tt('Scheduled maintenance')}</h1>
        <p style={{ lineHeight: 1.6, color: '#cbd5e1' }}>
          The system is temporarily unavailable while we complete a controlled production cutover.
          Financial writes are paused. Please try again after the maintenance window.
        </p>
      </div>
    </main>
  );
}
