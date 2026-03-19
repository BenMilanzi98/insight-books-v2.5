// app/api/pension/settings/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

function clampPercentOrNull(n) {
  // Allow "no value" (null/undefined/empty string) so tenants can configure later.
  if (n === null || n === undefined) return null;
  if (typeof n === 'string' && n.trim() === '') return null;
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.min(100, Math.max(0, v));
}

function isUnknownPrismaFieldError(err, fieldName) {
  const msg = err?.message || '';
  return msg.includes(`Unknown argument \`${fieldName}\``) || msg.includes(`Unknown argument "${fieldName}"`);
}

/** Read NPS rate from raw query row; Prisma/PostgreSQL may return column names in lowercase. */
function npsRateFromRow(row, field) {
  if (!row || typeof row !== 'object') return null;
  const camel = field === 'employee' ? row.npsEmployeeRatePercent : row.npsEmployerRatePercent;
  const lower = field === 'employee' ? row.npsemployeeratepercent : row.npsemployerratepercent;
  const raw = camel ?? lower;
  if (raw === null || raw === undefined) return null;
  const v = Number(raw);
  return Number.isFinite(v) ? v : null;
}

async function getOrCreateTenantSettings(tenantId) {
  const existing = await prisma.tenantSettings.findUnique({ where: { tenantId } });
  if (existing) return existing;
  return await prisma.tenantSettings.create({
    data: {
      tenantId,
      enabledModules: [],
      // defaults handled by schema
    },
  });
}

export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const settings = await getOrCreateTenantSettings(user.tenantId);

    // Prefer reading the configured rates directly from DB (works even if Prisma Client is stale).
    try {
      const rows = await prisma.$queryRaw`
        SELECT "npsEmployeeRatePercent", "npsEmployerRatePercent"
        FROM "TenantSettings"
        WHERE "tenantId" = ${user.tenantId}
        LIMIT 1
      `;
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row) {
        return NextResponse.json({
          npsEmployeeRatePercent: npsRateFromRow(row, 'employee'),
          npsEmployerRatePercent: npsRateFromRow(row, 'employer'),
        });
      }
    } catch (e) {
      // Columns may not exist yet or Prisma Client might not support them in this environment.
      // Fall back to defaults below.
      console.warn('Pension settings raw read failed, falling back:', e?.message || e);
    }

    return NextResponse.json({
      npsEmployeeRatePercent: settings.npsEmployeeRatePercent ?? null,
      npsEmployerRatePercent: settings.npsEmployerRatePercent ?? null,
    });
  } catch (error) {
    console.error('Error fetching pension settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pension settings', details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const employeeRate = clampPercentOrNull(body.npsEmployeeRatePercent);
    const employerRate = clampPercentOrNull(body.npsEmployerRatePercent);

    const settings = await getOrCreateTenantSettings(user.tenantId);

    let updated;
    try {
      updated = await prisma.tenantSettings.update({
        where: { tenantId: user.tenantId },
        data: {
          npsEmployeeRatePercent: employeeRate,
          npsEmployerRatePercent: employerRate,
        },
      });
    } catch (e) {
      // If Prisma Client is stale (common during dev without restart), fall back to raw SQL update.
      if (
        isUnknownPrismaFieldError(e, 'npsEmployeeRatePercent') ||
        isUnknownPrismaFieldError(e, 'npsEmployerRatePercent')
      ) {
        try {
          await prisma.$executeRaw`
            UPDATE "TenantSettings"
            SET "npsEmployeeRatePercent" = ${employeeRate},
                "npsEmployerRatePercent" = ${employerRate}
            WHERE "tenantId" = ${user.tenantId}
          `;
          // Best-effort read back (may still fail if columns don't exist)
          try {
            const rows = await prisma.$queryRaw`
              SELECT "npsEmployeeRatePercent", "npsEmployerRatePercent"
              FROM "TenantSettings"
              WHERE "tenantId" = ${user.tenantId}
              LIMIT 1
            `;
            const row = Array.isArray(rows) ? rows[0] : null;
            updated = {
              ...settings,
              npsEmployeeRatePercent: row ? (npsRateFromRow(row, 'employee') ?? employeeRate) : employeeRate,
              npsEmployerRatePercent: row ? (npsRateFromRow(row, 'employer') ?? employerRate) : employerRate,
            };
          } catch {
            updated = {
              ...settings,
              npsEmployeeRatePercent: employeeRate,
              npsEmployerRatePercent: employerRate,
            };
          }
        } catch (rawErr) {
          console.error('Raw pension settings update failed:', rawErr);
          return NextResponse.json(
            {
              error: 'Failed to update pension settings',
              details:
                'Database schema is likely not updated yet. Please run `npx prisma db push` (or deploy migrations) and restart the server.',
            },
            { status: 500 }
          );
        }
      } else {
        throw e;
      }
    }

    return NextResponse.json({
      message: 'Pension settings updated',
      npsEmployeeRatePercent: updated.npsEmployeeRatePercent ?? null,
      npsEmployerRatePercent: updated.npsEmployerRatePercent ?? null,
    });
  } catch (error) {
    console.error('Error updating pension settings:', error);
    return NextResponse.json(
      { error: 'Failed to update pension settings', details: error.message },
      { status: 500 }
    );
  }
}


