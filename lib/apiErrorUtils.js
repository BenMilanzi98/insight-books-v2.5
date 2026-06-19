/**
 * Map server errors to client-safe API responses (including production).
 */
export function extractApiErrorMessage(error, fallback = 'An unexpected error occurred.') {
  if (!error) return fallback;
  if (typeof error === 'string') {
    const trimmed = error.trim();
    return trimmed || fallback;
  }
  if (Array.isArray(error?.issues)) {
    return error.issues
      .map((issue) => {
        const path = Array.isArray(issue.path) && issue.path.length ? issue.path.join('.') : '';
        return path ? `${path}: ${issue.message}` : issue.message;
      })
      .join('; ');
  }
  const msg = String(error.message || '').trim();
  if (msg) return msg.length > 600 ? `${msg.slice(0, 600)}…` : msg;
  if (error.code) return `Database error (${error.code})`;
  const asString = String(error).trim();
  return asString && asString !== '[object Object]' ? asString : fallback;
}

export function publicApiErrorMessage(error, fallback = 'An unexpected error occurred.') {
  return extractApiErrorMessage(error, fallback);
}

/**
 * @param {unknown} error
 * @param {{ fallback?: string }} [opts]
 */
export function classifyApiError(error, opts = {}) {
  const fallback = opts.fallback || 'An unexpected error occurred.';
  const msg = String(error?.message || '');
  const code = error?.code;

  if (code === 'P2002') {
    return { status: 409, error: 'A record with this identifier already exists.' };
  }

  if (code === 'P2022' || /column `.+` does not exist in the current database/i.test(msg)) {
    const colMatch = msg.match(/column `([^`]+)` does not exist/i);
    const col = colMatch?.[1] || 'unknown';
    return {
      status: 503,
      error: `Database schema is out of date (missing column: ${col}). Run migrations: npm run db:migrate:deploy`,
    };
  }

  if (code === 'P2028' || /transaction already closed|interactive transaction/i.test(msg)) {
    return {
      status: 503,
      error:
        'The request timed out while posting accounting entries. Please try again. If it persists, create the invoice as Draft first, then post it.',
    };
  }

  if (code === 'P2003' || /foreign key constraint/i.test(msg)) {
    return {
      status: 400,
      error: 'A linked record is missing or invalid (client, product, or GL account). Check your selections and try again.',
    };
  }

  if (code === 'PERIOD_LOCKED' || msg.includes('closed accounting period')) {
    return {
      status: 403,
      error: msg.includes('Reopen') ? msg : `${msg} Reopen the period in Accounting Periods to post this invoice.`,
    };
  }

  if (
    msg.includes('cannot receive direct postings') ||
    msg.includes('consolidation parent') ||
    msg.includes('not open for new postings') ||
    msg.includes('Use a detail account')
  ) {
    return { status: 400, error: msg };
  }

  if (
    msg.includes('Accounts Receivable account not found') ||
    msg.includes('Account not found:')
  ) {
    return {
      status: 400,
      error: msg.includes('Accounts Receivable')
        ? `${msg} Ensure account 1200 Accounts Receivable exists in Chart of Accounts.`
        : msg,
    };
  }

  if (
    msg.includes('must reference an income account') ||
    msg.includes('must include valid account allocations') ||
    msg.includes('UNBALANCED') ||
    msg.includes('does not balance')
  ) {
    return { status: 400, error: msg };
  }

  if (
    msg.includes('DocumentSequence') ||
    msg.includes('Could not allocate document number') ||
    msg.includes('Could not allocate invoice number')
  ) {
    return {
      status: 503,
      error:
        'Document numbering is not configured. Run database migrations (DocumentSequence) or contact support.',
    };
  }

  if (msg.includes('Tax type not found') || msg.includes('no resolvable GL account')) {
    return { status: 400, error: msg };
  }

  if (msg.includes('Duplicate posted GL source')) {
    return { status: 409, error: msg };
  }

  if (msg.includes('UNBALANCED_ENTRY') || msg.includes('Revenue transaction validation failed')) {
    return { status: 400, error: msg };
  }

  return { status: 500, error: extractApiErrorMessage(error, fallback) };
}
