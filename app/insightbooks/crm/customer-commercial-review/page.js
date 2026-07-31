'use client';

import { useCallback, useState } from 'react';

/**
 * Token-gated customer commercial review surface.
 * Access only via high-entropy ?token= — no enumerable listing.
 */
export default function CustomerCommercialReviewPage() {
  const [token, setToken] = useState(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('token') || '';
  });
  const [review, setReview] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const loadReview = useCallback(async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(
        `/api/crm/customer-commercial-review?token=${encodeURIComponent(token)}`
      );
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'invalid_or_expired_token');
        setReview(null);
        return;
      }
      setReview(data.review);
      // Explicit view (delivery ≠ view)
      await fetch('/api/crm/customer-commercial-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'view',
          token,
          recipientId: data.review?.recipientId,
        }),
      });
    } catch {
      setError('load_failed');
    } finally {
      setBusy(false);
    }
  }, [token]);

  async function postAction(action, extra = {}) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/crm/customer-commercial-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          token,
          documentVersionId: review?.documentVersionId,
          artifactId: review?.artifactId,
          checksumSha256: review?.checksumSha256,
          recipientId: review?.recipientId,
          // Authority from verified recipient role (GET); never hardcode SIGNATORY
          authorityRole: review?.authorityRole || undefined,
          ...extra,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'action_failed');
        return;
      }
      setMessage(action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : 'ok');
      if (action === 'accept' || action === 'reject') {
        setReview((prev) =>
          prev
            ? {
                ...prev,
                status: action === 'accept' ? 'ACCEPTED' : 'REJECTED',
              }
            : prev
        );
      }
    } catch {
      setError('action_failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: '40px auto', padding: '0 16px', fontFamily: 'Georgia, serif' }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Commercial review</h1>
      <p style={{ color: '#475569', marginBottom: 24 }}>
        Secure link access only. Delivery does not imply view or acceptance.
      </p>

      {!review && (
        <div>
          <label htmlFor="review-token" style={{ display: 'block', marginBottom: 8 }}>
            Access token
          </label>
          <input
            id="review-token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            style={{ width: '100%', padding: 10, marginBottom: 12 }}
            autoComplete="off"
          />
          <button type="button" onClick={loadReview} disabled={busy || !token}>
            Open review
          </button>
        </div>
      )}

      {error && (
        <p role="alert" style={{ color: '#b91c1c', marginTop: 16 }}>
          {error}
        </p>
      )}
      {message && (
        <p role="status" style={{ color: '#166534', marginTop: 16 }}>
          {message}
        </p>
      )}

      {review && (
        <section style={{ marginTop: 24 }}>
          <p>
            <strong>{review.versionLabel}</strong> · {review.status}
          </p>
          <p>Total: {review.content?.totals?.grandTotal} {review.content?.totals?.currency}</p>
          {review.content?.internalNotes != null && (
            <p style={{ color: '#b91c1c' }}>Unexpected internal field leaked</p>
          )}
          <ul>
            {(review.content?.lineItems || []).map((li, idx) => (
              <li key={idx}>
                {li.productRef} × {li.quantity}
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button
              type="button"
              disabled={busy}
              onClick={() => postAction('accept')}
            >
              Accept
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => postAction('reject', { reason: 'Customer declined' })}
            >
              Reject
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                postAction('revision', { reason: 'Please revise commercial terms' })
              }
            >
              Request revision
            </button>
          </div>
          <p style={{ marginTop: 16, fontSize: 12, color: '#64748b' }}>
            E-sign: NOT_CONFIGURED — acceptance is authority-backed, not fabricated signature.
          </p>
        </section>
      )}
    </main>
  );
}
