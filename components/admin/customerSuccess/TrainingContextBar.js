'use client';

/**
 * Training Context Bar — Phase 18 Wave 4.
 * Filters + population + watermark + freshness + recon + DQ + permission scope + timezone.
 */
export default function TrainingContextBar({
  population = 'training',
  permissionScope = 'customerSuccess.read',
  watermark = 'none',
  freshness = 'UNKNOWN',
  reconStatus = 'UNKNOWN',
  dqStatus = 'UNKNOWN',
  timezone = 'Africa/Blantyre',
}) {
  return (
    <div
      role="region"
      aria-label="Training context"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.75rem',
        fontSize: '0.75rem',
        color: '#555',
        marginBottom: '1rem',
        padding: '0.5rem 0',
        borderBottom: '1px solid #e5e5e5',
      }}
    >
      <span>Population: {population}</span>
      <span>Scope: {permissionScope}</span>
      <span>Watermark: {watermark}</span>
      <span>Freshness: {freshness}</span>
      <span>Recon: {reconStatus}</span>
      <span>DQ: {dqStatus}</span>
      <span>TZ: {timezone}</span>
    </div>
  );
}
