import prisma from '@/lib/prisma';

export async function getTenantBranding(tenantId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      name: true,
      logoUrl: true,
      primaryColor: true,
      settings: {
        select: {
          businessAddress: true,
          businessCity: true,
          businessEmail: true,
          businessPhone: true
        }
      }
    }
  });

  return {
    name: tenant?.name || 'Company',
    logoUrl: tenant?.logoUrl || null,
    primaryColor: tenant?.primaryColor || '#1f2937',
    address: tenant?.settings?.businessAddress || null,
    city: tenant?.settings?.businessCity || null,
    email: tenant?.settings?.businessEmail || null,
    phone: tenant?.settings?.businessPhone || null
  };
}

