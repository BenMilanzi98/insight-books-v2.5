import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { permissionModules } from '@/lib/permissionsMap';

export async function GET() {
  try {
    // Get session cookie - FIXED: Properly await cookies()
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
   
    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
   
    try {
      // Parse session data
      const sessionData = JSON.parse(Buffer.from(sessionCookie.value, 'base64').toString());
     
      if (!sessionData.userId) {
        throw new Error('Invalid session');
      }
     
      // Get user data from database
      const user = await prisma.user.findUnique({
        where: { id: sessionData.userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          tenantId: true,
          defaultBranchId: true,
          isActive: true,
          tenant: sessionData.tenantId ? {
            select: {
              id: true,
              name: true,
              subdomain: true,
              status: true,
              logoUrl: true
            }
          } : undefined,
          defaultBranch: {
            select: {
              id: true,
              name: true,
              code: true,
              isActive: true
            }
          }
        }
      });
     
      if(!user && sessionData.userId){
        cookieStore.delete('session');
      }

      if (!user) {
        throw new Error('User not found');
      }

      // Backfill permissions for existing tenants that were created before newer modules existed.
      // We only auto-add for the built-in "Admin" role to avoid unintentionally changing custom roles.
      try {
        if (user?.role?.name === 'Admin') {
          const existingPerms = user?.role?.permissions || {};
          const nextPerms = { ...existingPerms };

          const ensureModule = (moduleKey) => {
            if (nextPerms[moduleKey]) return;
            const actions = permissionModules?.[moduleKey]?.actions || [];
            nextPerms[moduleKey] = actions.reduce((acc, action) => {
              acc[action] = true;
              return acc;
            }, {});
          };

          ensureModule('budgets');
          ensureModule('branches');
          ensureModule('journalEntries');
          ensureModule('trialBalance');
          ensureModule('generalLedger');

          // Only write if something actually changed
          const changed = JSON.stringify(nextPerms) !== JSON.stringify(existingPerms);
          if (changed) {
            const updatedRole = await prisma.role.update({
              where: { id: user.role.id },
              data: { permissions: nextPerms },
            });
            // Update response payload so client gets the new permissions immediately
            user.role = updatedRole;
          }
        }
      } catch (e) {
        // Non-fatal: do not block /api/auth/me
        console.error('Budget permissions backfill failed:', e?.message || e);
      }
     
      return NextResponse.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        defaultBranchId: user.defaultBranchId,
        defaultBranch: user.defaultBranch,
        tenant: user.tenant
      });
     
    } catch (error) {
      console.error('Error parsing session:', error);
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Error fetching current user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user data' },
      { status: 500 }
    );
  }
}