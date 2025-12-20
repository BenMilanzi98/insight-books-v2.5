// app/api/roles/route.js - New route to properly handle role management
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// GET - Fetch roles with filtering
export async function GET(request) {
  try {
    // Get authenticated user and ensure tenant isolation
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated with this user' },
        { status: 401 }
      );
    }
    
    const tenantId = user.tenantId;
    
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const sortBy = searchParams.get('sortBy') || 'name';
    const sortOrder = searchParams.get('sortOrder') || 'asc';
    const search = searchParams.get('search');
    
    // Build filter object for Prisma
    const where = {
      tenantId: tenantId // Ensure tenant isolation
    };
    
    // Add search filter if provided
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    // Build sort object for Prisma
    const orderBy = { [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc' };
    
    // Fetch roles with user counts, filtered by tenant
    const roles = await prisma.role.findMany({
      where,
      orderBy,
      include: {
        _count: {
          select: { users: true }
        }
      }
    });
    
    // Format roles for the frontend
    const formattedRoles = roles.map(role => ({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions,
      users: role._count.users, // Add user count
      createdAt: role.createdAt
    }));
    
    // Return formatted roles
    return NextResponse.json(formattedRoles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch roles. Please try again.' },
      { status: 500 }
    );
  }
}

// POST - Create a new role
export async function POST(request) {
  try {
    // Get authenticated user and ensure tenant isolation
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated with this user' },
        { status: 401 }
      );
    }
    
    const tenantId = user.tenantId;
    
    // Parse request body
    const body = await request.json();
    
    // Validate required fields
    if (!body.name || !body.description) {
      return NextResponse.json(
        { error: 'Name and description are required' },
        { status: 400 }
      );
    }
    
    // Check if role with same name already exists for this tenant
    const existingRole = await prisma.role.findFirst({
      where: {
        name: body.name,
        tenantId: tenantId
      }
    });
    
    if (existingRole) {
      return NextResponse.json(
        { error: 'A role with this name already exists' },
        { status: 400 }
      );
    }
    
    // Create the role
    const role = await prisma.role.create({
      data: {
        name: body.name,
        description: body.description,
        permissions: body.permissions || {},
        tenantId: tenantId // Ensure tenant association
      }
    });
    
    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'ROLE_CREATED',
        entityType: 'ROLE',
        entityId: role.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          name: role.name,
          description: role.description
        })
      }
    });
    
    return NextResponse.json(role);
  } catch (error) {
    console.error('Error creating role:', error);
    return NextResponse.json(
      { error: 'Failed to create role. Please try again.' },
      { status: 500 }
    );
  }
}