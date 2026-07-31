/**
 * SMTP adapter for CRM Email Activity — Phase 13 Wave 2.
 * Maps nodemailer accept → ACCEPTED_BY_PROVIDER / SENT / FAILED.
 * Never invents DELIVERED, opens, or replies. No tracking pixels.
 *
 * Reuses platform SMTP env (EMAIL_HOST / EMAIL_USER / EMAIL_PASSWORD)
 * via nodemailer — same stack as lib/email.js / lib/emailService.js.
 */

import nodemailer from 'nodemailer';
import { CRM_EMAIL_SEND_STATUS } from './catalogue.js';

/**
 * @param {{
 *   to: string,
 *   subject: string,
 *   html?: string|null,
 *   text?: string|null,
 *   from?: string|null,
 * }} mail
 * @returns {Promise<{
 *   ok: boolean,
 *   mappedStatus: string,
 *   messageId?: string|null,
 *   response?: string|null,
 *   accepted?: string[],
 *   rejected?: string[],
 *   error?: string|null,
 *   delivered: false,
 * }>}
 */
export async function defaultSmtpSend(mail) {
  const hasEmailConfig = !!(
    process.env.EMAIL_HOST &&
    process.env.EMAIL_USER &&
    process.env.EMAIL_PASSWORD
  );

  if (!hasEmailConfig) {
    return {
      ok: false,
      mappedStatus: CRM_EMAIL_SEND_STATUS.FAILED,
      messageId: null,
      response: null,
      error: 'smtp_not_configured',
      delivered: false,
    };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  try {
    const info = await transporter.sendMail({
      from:
        mail.from ||
        process.env.EMAIL_FROM ||
        `"InsightBooks" <${process.env.EMAIL_USER}>`,
      to: mail.to,
      subject: mail.subject,
      html: mail.html || undefined,
      text: mail.text || undefined,
    });

    if (info.rejected?.length) {
      return {
        ok: false,
        mappedStatus: CRM_EMAIL_SEND_STATUS.FAILED,
        messageId: info.messageId || null,
        response: info.response || null,
        accepted: info.accepted || [],
        rejected: info.rejected || [],
        error: `SMTP rejected: ${info.rejected.join(', ')}`,
        delivered: false,
      };
    }

    // Provider accepted the message for relay — not mailbox-delivered
    const mappedStatus = info.messageId
      ? CRM_EMAIL_SEND_STATUS.SENT
      : CRM_EMAIL_SEND_STATUS.ACCEPTED_BY_PROVIDER;

    return {
      ok: true,
      mappedStatus,
      messageId: info.messageId || null,
      response: info.response || null,
      accepted: info.accepted || [],
      rejected: info.rejected || [],
      error: null,
      delivered: false,
    };
  } catch (err) {
    return {
      ok: false,
      mappedStatus: CRM_EMAIL_SEND_STATUS.FAILED,
      messageId: null,
      response: null,
      error: err?.message || 'smtp_send_failed',
      delivered: false,
    };
  }
}

/**
 * @param {object} mail
 * @param {{ sendFn?: typeof defaultSmtpSend }} [deps]
 */
export async function sendCrmSmtpMail(mail, deps = {}) {
  const sendFn = typeof deps.sendFn === 'function' ? deps.sendFn : defaultSmtpSend;
  const result = await sendFn(mail);
  return {
    ...result,
    delivered: false,
    opens: null,
    replies: null,
    inventDeliveredForbidden: true,
    inventOpensForbidden: true,
    inventRepliesForbidden: true,
  };
}
