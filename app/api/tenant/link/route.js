// app/api/admin/link-user/route.js

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request) {
  try {
        const users = await prisma.user.findMany({
            where: {
            tenantId: {
                not: null
            }
            },
            select: {
            id: true,
            tenantId: true
            }
        });

    for (const user of users) {
        await prisma.tenant.update({
        where: { id: user.tenantId },
        data: {
            members: {
            connect: { id: user.id }
            }
        }
        });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
