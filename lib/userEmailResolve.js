/**
 * Email is unique per tenant (not globally). Helpers for auth and user CRUD.
 */

export function normalizeLoginEmail(email) {
  return String(email ?? '').trim();
}

/**
 * All users matching email (case-insensitive), light shape for login / OTP disambiguation.
 */
export async function findUsersByEmailForAuth(prismaClient, emailNorm) {
  if (!emailNorm) return [];
  return prismaClient.user.findMany({
    where: { email: { equals: emailNorm, mode: 'insensitive' } },
    select: {
      id: true,
      email: true,
      name: true,
      password: true,
      isActive: true,
      isEmailVerified: true,
      otpCode: true,
      otpExpiry: true,
      tenantId: true,
      authProviderId: true,
      authProvider: true,
      lastLogin: true,
      createdAt: true,
      role: {
        select: { id: true, name: true, description: true, permissions: true },
      },
      tenant: {
        select: { id: true, name: true, subdomain: true, status: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Pick one user when email matches several tenants. Returns null if ambiguous and hints insufficient.
 * @param {import('@prisma/client').PrismaClient} prismaClient
 * @param {Awaited<ReturnType<typeof findUsersByEmailForAuth>>} candidates
 * @param {{ tenantId?: string, subdomain?: string, googleSub?: string }} [hint]
 */
export async function pickUserForLogin(prismaClient, candidates, hint = {}) {
  if (!candidates?.length) return null;
  if (candidates.length === 1) return candidates[0];

  if (hint.googleSub) {
    const m = candidates.find(
      (u) =>
        u.authProvider === 'google' &&
        u.authProviderId &&
        String(u.authProviderId) === String(hint.googleSub)
    );
    if (m) return m;
  }

  if (hint.tenantId) {
    const m = candidates.find((u) => u.tenantId === hint.tenantId);
    if (m) return m;
  }

  if (hint.subdomain) {
    const sub = String(hint.subdomain).trim().toLowerCase();
    const tenant = await prismaClient.tenant.findFirst({
      where: { subdomain: { equals: sub, mode: 'insensitive' } },
      select: { id: true },
    });
    if (tenant?.id) {
      const m = candidates.find((u) => u.tenantId === tenant.id);
      if (m) return m;
    }
  }

  return null;
}

export function tenantsHintFromUserCandidates(candidates) {
  const map = new Map();
  for (const c of candidates || []) {
    const t = c.tenant;
    if (t?.id && !map.has(t.id)) {
      map.set(t.id, { id: t.id, name: t.name, subdomain: t.subdomain });
    }
  }
  return [...map.values()];
}
