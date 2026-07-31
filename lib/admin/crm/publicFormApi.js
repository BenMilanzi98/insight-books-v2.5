/**
 * Shared helpers for public CRM capture API routes (Wave 2).
 * Spam guards: payload size (in captureLead) + honeypot field `website`.
 * No existing Next middleware rate-limit is reused; capture.js has a
 * process-local email throttle (8 / 60s).
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { captureLead, CRM_CAPTURE_SOURCE } from '@/lib/admin/crm';

/**
 * @param {Request} request
 * @param {string} sourceCode
 */
export async function handlePublicCapturePost(request, sourceCode) {
  try {
    const body = await request.json().catch(() => ({}));

    const result = await captureLead(prisma, {
      sourceCode: sourceCode || body.sourceCode || CRM_CAPTURE_SOURCE.WEBSITE_CONTACT_FORM,
      businessName: body.businessName,
      contactName: body.contactName || body.clientName,
      email: body.email,
      phone: body.phone,
      message: body.message || body.body,
      preferredAt: body.dateTime || body.preferredAt || null,
      consentPurposes: body.consentPurposes,
      // Client idempotency keys ignored — captureLead derives stable identity server-side.
      website: body.website,
      companyUrl: body.companyUrl,
      hp_field: body.hp_field,
    });

    if (!result.ok) {
      const status =
        result.status === 'NOT_AVAILABLE'
          ? 501
          : result.error === 'spam_rejected'
            ? 400
            : result.error === 'payload_too_large' || result.error === 'rate_limited'
              ? 429
              : 400;
      return NextResponse.json(
        { success: false, error: result.error || 'capture_failed', ...result },
        { status }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Request submitted successfully. We will contact you soon.',
        leadNumber: result.lead?.leadNumber || null,
        created: result.created !== false,
        idempotent: Boolean(result.idempotent),
      },
      { status: result.idempotent ? 200 : 201 }
    );
  } catch (error) {
    console.error('CRM public capture error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit request. Please try again.' },
      { status: 500 }
    );
  }
}
