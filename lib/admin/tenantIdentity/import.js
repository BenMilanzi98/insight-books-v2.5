import prisma from '@/lib/prisma';
import { validateTenantIdentityPackage } from './validate.js';
import { normalizeTenantStatus } from './filters.js';
import { pickSafeSettings } from './settingsFields.js';

function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Dry-run or commit identity import with skip-on-conflict.
 * @param {object} pkg
 * @param {{ commit?: boolean }} options
 */
export async function importTenantIdentityPackage(pkg, options = {}, db = prisma) {
  const validation = validateTenantIdentityPackage(pkg);
  if (!validation.ok) {
    return {
      success: false,
      dryRun: !options.commit,
      errors: validation.errors,
      summary: { create: 0, skip: 0, invalid: validation.errors.length },
      tenants: [],
    };
  }

  const results = [];
  let createCount = 0;
  let skipCount = 0;
  let invalidCount = 0;

  for (const tp of pkg.tenants) {
    const tenantId = tp.tenant.id;
    const subdomain = tp.tenant.subdomain;

    const existingById = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, subdomain: true },
    });
    const existingBySub = await db.tenant.findUnique({
      where: { subdomain },
      select: { id: true, subdomain: true },
    });

    if (existingById || existingBySub) {
      skipCount += 1;
      results.push({
        tenantId,
        subdomain,
        outcome: 'skip',
        reason: existingById
          ? `Tenant id already exists (${existingById.subdomain})`
          : `Subdomain already exists (${existingBySub.id})`,
        created: { roles: 0, users: 0, memberships: 0, subscriptions: 0 },
        skipped: { roles: 0, users: 0, memberships: 0, subscriptions: 0 },
      });
      continue;
    }

    // Validate roles referenced by users exist in package
    const roleIds = new Set((tp.roles || []).map((r) => r.id));
    const missingRole = (tp.users || []).find((u) => u.roleId && !roleIds.has(u.roleId));
    if (missingRole) {
      invalidCount += 1;
      results.push({
        tenantId,
        subdomain,
        outcome: 'invalid',
        reason: `User ${missingRole.email} references missing roleId ${missingRole.roleId}`,
      });
      continue;
    }

    if (!options.commit) {
      createCount += 1;
      results.push({
        tenantId,
        subdomain,
        outcome: 'create',
        reason: 'Would create tenant identity package',
        created: {
          roles: (tp.roles || []).length,
          users: (tp.users || []).length,
          memberships: (tp.memberships || []).length,
          subscriptions: (tp.subscriptions || []).length,
        },
        skipped: { roles: 0, users: 0, memberships: 0, subscriptions: 0 },
      });
      continue;
    }

    try {
      const created = await db.$transaction(async (tx) => {
        const counts = {
          roles: 0,
          users: 0,
          memberships: 0,
          subscriptions: 0,
        };
        const skipped = {
          roles: 0,
          users: 0,
          memberships: 0,
          subscriptions: 0,
        };

        await tx.tenant.create({
          data: {
            id: tenantId,
            name: tp.tenant.name,
            subdomain,
            status: normalizeTenantStatus(tp.tenant.status),
            subscriptionPlan: tp.tenant.subscriptionPlan || 'trial',
            logoUrl: tp.tenant.logoUrl ?? null,
            primaryColor: tp.tenant.primaryColor ?? null,
            secondaryColor: tp.tenant.secondaryColor ?? null,
            faviconUrl: tp.tenant.faviconUrl ?? null,
            ownerUserId: null,
            defaultBranchId: null,
            tpin: tp.tenant.tpin ?? null,
            eisEnabled: Boolean(tp.tenant.eisEnabled),
          },
        });

        if (tp.settings) {
          const safe = pickSafeSettings(tp.settings);
          const settingsData = {
            id: tp.settings.id || undefined,
            tenantId,
            ...safe,
            capitalSetupCompletedAt: parseDate(safe.capitalSetupCompletedAt),
            paymentAccountsSetupCompletedAt: parseDate(safe.paymentAccountsSetupCompletedAt),
            openingBalancesAsOfDate: parseDate(safe.openingBalancesAsOfDate),
            setupReminderSnoozedUntil: parseDate(safe.setupReminderSnoozedUntil),
          };
          // Drop unknown keys that Prisma may reject on this app version
          delete settingsData.preferredLanguage;
          try {
            await tx.tenantSettings.create({ data: settingsData });
          } catch (settingsErr) {
            // Retry without optional v2.5-only fields
            const fallback = { ...settingsData };
            delete fallback.defaultLanguage;
            delete fallback.payrollAccountMappings;
            delete fallback.rentalPostInvoiceOnBook;
            delete fallback.rentalAutoCompleteExpired;
            delete fallback.rentalLegacyBookingEnabled;
            await tx.tenantSettings.create({ data: fallback });
          }
        } else {
          await tx.tenantSettings.create({
            data: { tenantId, enabledModules: [] },
          });
        }

        for (const role of tp.roles || []) {
          const exists = await tx.role.findUnique({ where: { id: role.id }, select: { id: true } });
          if (exists) {
            skipped.roles += 1;
            continue;
          }
          await tx.role.create({
            data: {
              id: role.id,
              name: role.name,
              description: role.description || '',
              permissions: role.permissions ?? {},
              tenantId,
            },
          });
          counts.roles += 1;
        }

        for (const user of tp.users || []) {
          const byId = await tx.user.findUnique({ where: { id: user.id }, select: { id: true } });
          if (byId) {
            skipped.users += 1;
            continue;
          }
          const byEmail = await tx.user.findFirst({
            where: { tenantId, email: user.email },
            select: { id: true },
          });
          if (byEmail) {
            skipped.users += 1;
            continue;
          }

          const userData = {
            id: user.id,
            email: user.email,
            name: user.name ?? null,
            password: user.password,
            tenantId,
            roleId: user.roleId,
            isActive: user.isActive !== false,
            status: user.status || 'active',
            isEmailVerified: Boolean(user.isEmailVerified),
            phone: user.phone ?? null,
            department: user.department ?? null,
            authProvider: user.authProvider ?? null,
            authProviderId: user.authProviderId ?? null,
            otpCode: null,
            otpExpiry: null,
            resetToken: null,
            resetTokenExpiry: null,
          };
          try {
            if (user.preferredLanguage) {
              await tx.user.create({
                data: { ...userData, preferredLanguage: user.preferredLanguage },
              });
            } else {
              await tx.user.create({ data: userData });
            }
          } catch {
            await tx.user.create({ data: userData });
          }
          counts.users += 1;
        }

        for (const m of tp.memberships || []) {
          const byId = await tx.tenantMembership.findUnique({
            where: { id: m.id },
            select: { id: true },
          });
          if (byId) {
            skipped.memberships += 1;
            continue;
          }
          const pair = await tx.tenantMembership.findUnique({
            where: { userId_tenantId: { userId: m.userId, tenantId } },
            select: { id: true },
          });
          if (pair) {
            skipped.memberships += 1;
            continue;
          }
          const userExists = await tx.user.findUnique({
            where: { id: m.userId },
            select: { id: true },
          });
          const roleExists = await tx.role.findUnique({
            where: { id: m.roleId },
            select: { id: true },
          });
          if (!userExists || !roleExists) {
            skipped.memberships += 1;
            continue;
          }
          await tx.tenantMembership.create({
            data: {
              id: m.id,
              userId: m.userId,
              tenantId,
              roleId: m.roleId,
              status: m.status || 'active',
            },
          });
          counts.memberships += 1;
        }

        for (const s of tp.subscriptions || []) {
          const byId = await tx.accountSubscription.findUnique({
            where: { id: s.id },
            select: { id: true },
          });
          if (byId) {
            skipped.subscriptions += 1;
            continue;
          }
          const byTx = await tx.accountSubscription.findUnique({
            where: { txRef: s.txRef },
            select: { id: true },
          });
          if (byTx) {
            skipped.subscriptions += 1;
            continue;
          }
          await tx.accountSubscription.create({
            data: {
              id: s.id,
              tenantId,
              plan: s.plan || 'trial',
              txRef: s.txRef,
              amount: Number(s.amount) || 0,
              currency: s.currency || 'MWK',
              status: s.status || 'Pending',
              paymentMethod: s.paymentMethod ?? null,
              notes: s.notes ?? null,
              isActive: Boolean(s.isActive),
              startedAt: parseDate(s.startedAt),
              expiresAt: parseDate(s.expiresAt),
              paymentDate: parseDate(s.paymentDate),
              gatewayResponse: s.gatewayResponse ?? undefined,
              isTrial: Boolean(s.isTrial),
              trialEndDate: parseDate(s.trialEndDate),
              trialStartDate: parseDate(s.trialStartDate),
            },
          });
          counts.subscriptions += 1;
        }

        // Resolve owner
        let ownerUserId = tp.tenant.ownerUserId || null;
        if (ownerUserId) {
          const owner = await tx.user.findUnique({
            where: { id: ownerUserId },
            select: { id: true, tenantId: true },
          });
          if (!owner || owner.tenantId !== tenantId) ownerUserId = null;
        }
        if (!ownerUserId) {
          const first = await tx.user.findFirst({
            where: { tenantId, isActive: true },
            orderBy: { createdAt: 'asc' },
            select: { id: true },
          });
          ownerUserId = first?.id || null;
        }
        if (ownerUserId) {
          await tx.tenant.update({
            where: { id: tenantId },
            data: { ownerUserId },
          });
        }

        return { counts, skipped, ownerUserId };
      });

      createCount += 1;
      results.push({
        tenantId,
        subdomain,
        outcome: 'create',
        reason: 'Created tenant identity package',
        created: created.counts,
        skipped: created.skipped,
        ownerUserId: created.ownerUserId,
      });
    } catch (err) {
      invalidCount += 1;
      results.push({
        tenantId,
        subdomain,
        outcome: 'invalid',
        reason: err?.message || 'Failed to import tenant',
      });
    }
  }

  return {
    success: invalidCount === 0 || createCount + skipCount > 0,
    dryRun: !options.commit,
    summary: {
      create: createCount,
      skip: skipCount,
      invalid: invalidCount,
      total: pkg.tenants.length,
    },
    tenants: results,
  };
}
