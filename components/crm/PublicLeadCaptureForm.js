'use client';

import { useState } from 'react';
import Link from 'next/link';

/**
 * Minimal public CRM capture form (Wave 2).
 * Posts to a capture API; includes honeypot `website` (must stay empty).
 */
export default function PublicLeadCaptureForm({
  title,
  subtitle,
  apiPath,
  submitLabel = 'Submit',
  showPreferredTime = false,
}) {
  const [formData, setFormData] = useState({
    businessName: '',
    contactName: '',
    email: '',
    phone: '',
    message: '',
    preferredAt: '',
    website: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [ok, setOk] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage('');
    setOk(false);
    try {
      const response = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setOk(true);
        setSubmitMessage(data.message || 'Submitted successfully.');
        setFormData({
          businessName: '',
          contactName: '',
          email: '',
          phone: '',
          message: '',
          preferredAt: '',
          website: '',
        });
      } else {
        setSubmitMessage(data.error || 'Submission failed. Please try again.');
      }
    } catch {
      setSubmitMessage('Submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <div className="mb-8 text-center">
        <p className="text-sm font-semibold tracking-wide text-slate-500">InsightBooks</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">{title}</h1>
        {subtitle ? (
          <p className="mt-3 text-base text-slate-600">{subtitle}</p>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Business name *
            <input
              required
              name="businessName"
              value={formData.businessName}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Your name *
            <input
              required
              name="contactName"
              value={formData.contactName}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Email *
            <input
              required
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Phone *
            <input
              required
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
        </div>
        {showPreferredTime ? (
          <label className="block text-sm font-medium text-slate-700">
            Preferred time
            <input
              type="datetime-local"
              name="preferredAt"
              value={formData.preferredAt}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
        ) : null}
        <label className="block text-sm font-medium text-slate-700">
          Message *
          <textarea
            required
            name="message"
            rows={4}
            value={formData.message}
            onChange={handleChange}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        {/* Honeypot — leave empty */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Website
            <input
              tabIndex={-1}
              autoComplete="off"
              name="website"
              value={formData.website}
              onChange={handleChange}
            />
          </label>
        </div>
        {submitMessage ? (
          <p className={`text-sm ${ok ? 'text-emerald-700' : 'text-red-600'}`}>{submitMessage}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isSubmitting ? 'Submitting…' : submitLabel}
          </button>
          <Link href="/contact" className="text-sm text-slate-600 underline">
            Contact page
          </Link>
        </div>
      </form>
    </div>
  );
}
