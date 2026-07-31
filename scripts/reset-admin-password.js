/**
 * Reset password for a tenant user (email is unique per tenant, not globally).
 *
 * Usage:
 *   node scripts/reset-admin-password.js <email> <newPassword> [tenantSubdomain|tenantId]
 *
 * Examples:
 *   node scripts/reset-admin-password.js admin@example.com MyNewPassword123
 *   node scripts/reset-admin-password.js admin@example.com MyNewPassword123 insightbooks
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

function normalizeEmail(email) {
  return String(email ?? '').trim();
}

async function findUsersByEmail(email) {
  const emailNorm = normalizeEmail(email);
  if (!emailNorm) return [];

  return prisma.user.findMany({
    where: { email: { equals: emailNorm, mode: 'insensitive' } },
    select: {
      id: true,
      email: true,
      name: true,
      tenantId: true,
      tenant: { select: { id: true, name: true, subdomain: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

async function pickUser(candidates, tenantHint) {
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0];

  if (!tenantHint) return null;

  const hint = String(tenantHint).trim();
  const byTenantId = candidates.find((u) => u.tenantId === hint);
  if (byTenantId) return byTenantId;

  const sub = hint.toLowerCase();
  return (
    candidates.find((u) => u.tenant?.subdomain?.toLowerCase() === sub) || null
  );
}

async function resetAdminPassword(email, newPassword, tenantHint) {
  try {
    console.log(`\n🔐 Resetting password for: ${email}`);

    const candidates = await findUsersByEmail(email);
    const user = await pickUser(candidates, tenantHint);

    if (!user) {
      if (candidates.length > 1) {
        console.error('❌ This email is used for more than one business. Pass tenant subdomain or tenantId as the 3rd argument:\n');
        for (const u of candidates) {
          console.error(
            `   - ${u.tenant?.name ?? 'Unknown'} (subdomain: ${u.tenant?.subdomain ?? 'n/a'}, tenantId: ${u.tenantId})`
          );
        }
      } else {
        console.error('❌ User not found!');
      }
      process.exit(1);
    }

    console.log(
      `✅ User found: ${user.name} @ ${user.tenant?.name ?? 'Unknown tenant'} (ID: ${user.id})`
    );

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    console.log('\n✅ Password reset successfully!');
    console.log(`📧 Email: ${user.email}`);
    console.log(`🏢 Tenant: ${user.tenant?.name ?? user.tenantId}`);
    console.log(`🔑 New password: ${newPassword}`);
  } catch (error) {
    console.error('❌ Error resetting password:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

const email = process.argv[2];
const newPassword = process.argv[3];
const tenantHint = process.argv[4];

if (!email || !newPassword) {
  console.log('\n📝 Usage: node scripts/reset-admin-password.js <email> <newPassword> [tenantSubdomain|tenantId]');
  console.log('\nExamples:');
  console.log('   node scripts/reset-admin-password.js admin@insightbooks.com MyNewPassword123');
  console.log('   node scripts/reset-admin-password.js admin@insightbooks.com MyNewPassword123 insightbooks');
  process.exit(1);
}

resetAdminPassword(email, newPassword, tenantHint);
