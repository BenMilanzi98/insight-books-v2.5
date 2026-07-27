/**
 * Platform import dry-run — validate CSV/JSON rows without writing to the DB.
 */

export const IMPORT_DRY_RUN_MAX_ROWS = 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @typedef {{ row: number, field?: string, message: string }} ImportDryRunError
 * @typedef {{ ok: boolean, errors: ImportDryRunError[], preview: object[], type: string, rowCount: number }} ImportDryRunResult
 */

/**
 * Normalize inbound rows from JSON array or simple CSV string.
 * @param {unknown} input
 * @returns {{ rows: object[], parseErrors: ImportDryRunError[] }}
 */
export function normalizeImportRows(input) {
  if (Array.isArray(input)) {
    return {
      rows: input.map((row, i) =>
        row != null && typeof row === 'object' && !Array.isArray(row)
          ? row
          : { _raw: row, _index: i }
      ),
      parseErrors: [],
    };
  }

  if (typeof input === 'string') {
    return parseCsvToObjects(input);
  }

  return {
    rows: [],
    parseErrors: [{ row: 0, message: 'rows must be an array of objects or a CSV string' }],
  };
}

/**
 * Minimal CSV parser (header row required). Supports quoted fields.
 * @param {string} csv
 */
function parseCsvToObjects(csv) {
  const parseErrors = [];
  const text = String(csv || '').replace(/^\uFEFF/, '').trim();
  if (!text) {
    return { rows: [], parseErrors: [{ row: 0, message: 'CSV is empty' }] };
  }

  const lines = splitCsvLines(text);
  if (lines.length < 2) {
    return {
      rows: [],
      parseErrors: [{ row: 0, message: 'CSV must include a header row and at least one data row' }],
    };
  }

  const headers = splitCsvRow(lines[0]).map((h) => h.trim());
  if (headers.some((h) => !h)) {
    parseErrors.push({ row: 1, message: 'CSV header contains an empty column name' });
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i]);
    if (cols.every((c) => String(c).trim() === '')) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      if (h) obj[h] = cols[idx] != null ? cols[idx] : '';
    });
    rows.push(obj);
  }

  return { rows, parseErrors };
}

function splitCsvLines(text) {
  const lines = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      lines.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.length) lines.push(current);
  return lines;
}

function splitCsvRow(line) {
  const cols = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      cols.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  cols.push(current);
  return cols;
}

function str(v) {
  if (v == null) return '';
  return String(v).trim();
}

/**
 * Validate import rows for dry-run. Never persists.
 * @param {'tenants'|'users'} type
 * @param {unknown} rowsInput
 * @returns {ImportDryRunResult}
 */
export function dryRunImport(type, rowsInput) {
  const importType = String(type || '').trim().toLowerCase();
  if (!['tenants', 'users'].includes(importType)) {
    return {
      ok: false,
      type: importType || 'unknown',
      rowCount: 0,
      errors: [{ row: 0, message: "type must be 'tenants' or 'users'" }],
      preview: [],
    };
  }

  const { rows, parseErrors } = normalizeImportRows(rowsInput);
  const errors = [...parseErrors];

  if (rows.length > IMPORT_DRY_RUN_MAX_ROWS) {
    return {
      ok: false,
      type: importType,
      rowCount: rows.length,
      errors: [
        {
          row: 0,
          message: `Too many rows (${rows.length}). Maximum is ${IMPORT_DRY_RUN_MAX_ROWS}.`,
        },
      ],
      preview: [],
    };
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push({ row: 0, message: 'No rows to validate' });
  }

  const preview = [];
  const seenKeys = new Set();

  rows.forEach((row, idx) => {
    const rowNum = idx + 1;
    if (importType === 'tenants') {
      const name = str(row.name ?? row.tenantName ?? row.Name);
      const subdomain = str(row.subdomain ?? row.slug ?? row.Subdomain).toLowerCase();
      const status = (str(row.status ?? row.Status) || 'active').toLowerCase();
      const plan = str(row.subscriptionPlan ?? row.plan ?? row.Plan) || 'trial';

      if (!name) errors.push({ row: rowNum, field: 'name', message: 'name is required' });
      if (!subdomain) {
        errors.push({ row: rowNum, field: 'subdomain', message: 'subdomain is required' });
      } else if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)) {
        errors.push({
          row: rowNum,
          field: 'subdomain',
          message: 'subdomain must be a valid DNS label',
        });
      }

      const key = `subdomain:${subdomain}`;
      if (subdomain && seenKeys.has(key)) {
        errors.push({
          row: rowNum,
          field: 'subdomain',
          message: `duplicate subdomain in file: ${subdomain}`,
        });
      } else if (subdomain) {
        seenKeys.add(key);
      }

      preview.push({
        row: rowNum,
        name,
        subdomain,
        status,
        subscriptionPlan: plan,
      });
      return;
    }

    // users
    const email = str(row.email ?? row.Email).toLowerCase();
    const name = str(row.name ?? row.fullName ?? row.Name);
    const tenantId = str(row.tenantId ?? row.tenant_id ?? row.TenantId);
    const role = str(row.role ?? row.Role) || 'User';

    if (!email) {
      errors.push({ row: rowNum, field: 'email', message: 'email is required' });
    } else if (!EMAIL_RE.test(email)) {
      errors.push({ row: rowNum, field: 'email', message: 'email is invalid' });
    }
    if (!name) errors.push({ row: rowNum, field: 'name', message: 'name is required' });

    const key = `email:${email}`;
    if (email && seenKeys.has(key)) {
      errors.push({
        row: rowNum,
        field: 'email',
        message: `duplicate email in file: ${email}`,
      });
    } else if (email) {
      seenKeys.add(key);
    }

    preview.push({
      row: rowNum,
      email,
      name,
      tenantId: tenantId || null,
      role,
    });
  });

  return {
    ok: errors.length === 0,
    type: importType,
    rowCount: rows.length,
    errors,
    preview: preview.slice(0, 50),
  };
}
