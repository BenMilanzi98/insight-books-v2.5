// app/api/users/route.js - Modified to ensure tenant isolation
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { userHasAccessToTenant } from '@/lib/tenantStockAccess';
import { generateSixCharAlphanumericPassword } from '@/lib/generateTemporaryPassword';
import { getPublicAppBaseUrlForEmail } from '@/lib/publicAppUrl';

// GET - Fetch users with filtering, sorting, and pagination
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'users.view');
    if (perm) return perm;

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
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const status = searchParams.get('status');
    const role = searchParams.get('role');
    const search = searchParams.get('search');
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Build filter object for Prisma
    const where = {
      tenantId: tenantId // Ensure tenant isolation
    };
    
    // Add status filter if provided
    if (status && status !== 'all') {
      where.status = status;
    }
    
    // Add role filter if provided
    if (role && role !== 'all') {
      where.roleId = role; // Assuming role is stored as roleId in User model
    }
    
    // Add search filter if provided
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    // Get total count for pagination
    const totalCount = await prisma.user.count({ where });
    
    // Build sort object for Prisma
    const orderBy = { [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc' };
    
    // Fetch users with their role and userBranches (allowed branches for separation by branch).
    // Be backward compatible with databases that might not yet have UserBranch / branch separation schema.
    let users;
    try {
      users = await prisma.user.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          role: {
            select: {
              id: true,
              name: true,
              permissions: true
            }
          },
          userBranches: { select: { branchId: true } }
        }
      });
    } catch (schemaError) {
      console.error('Users list query (with userBranches) failed, falling back to legacy select:', schemaError?.message || schemaError);
      users = await prisma.user.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          role: {
            select: {
              id: true,
              name: true,
              permissions: true
            }
          }
        }
      });
    }

    // Add roleType and allowedBranchIds for frontend (allowedBranchIds empty when branch separation not available)
    const formattedUsers = users.map(user => {
      const { userBranches, ...rest } = user;
      const allowedBranchIds = userBranches?.map((ub) => ub.branchId).filter(Boolean) ?? [];
      return {
        ...rest,
        roleType: user.role?.name || 'user',
        allowedBranchIds
      };
    });
    
    // Return users with pagination metadata
    return NextResponse.json({
      users: formattedUsers,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users. Please try again.' },
      { status: 500 }
    );
  }
}

// POST - Create a new user
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'users.create');
    if (perm) return perm;

    // Get authenticated user to get the tenant ID
    const currentUser = await getUserFromSession(request);
    if (!currentUser || !currentUser.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated with this user' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    
    // Validate required fields
    if (!body.name || !body.email || !body.role) {
      return NextResponse.json(
        { error: 'Name, email, and role are required' },
        { status: 400 }
      );
    }
    
    // Per-tenant uniqueness: same email is allowed in other businesses.
    const existingUser = await prisma.user.findFirst({
      where: {
        email: { equals: String(body.email).trim(), mode: 'insensitive' },
        tenantId: currentUser.tenantId,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'This email is already used for a user in this business' },
        { status: 400 }
      );
    }
    
    // Auto-generated welcome password: exactly 6 alphanumeric chars (letters + digits)
    const trimmedProvided =
      typeof body.password === 'string' && body.password.trim() ? body.password.trim() : '';
    const password = trimmedProvided || generateSixCharAlphanumericPassword();
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const tenantId = currentUser.tenantId;
    const defaultBranchId = body.defaultBranchId && String(body.defaultBranchId).trim() ? body.defaultBranchId : null;
    const allowedBranchIds = Array.isArray(body.allowedBranchIds) ? body.allowedBranchIds : [];

    // Create the user with tenant association
    const newUser = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        password: hashedPassword,
        role: {
          connect: {
            id: body.role // Connect to the role using the ID
          }
        },
        tenant: {
          connect: {
            id: tenantId
          }
        },
        department: body.department && String(body.department).trim() ? String(body.department).trim() : null,
        status: body.status || 'active',
        // Invited tenant users skip OTP; self-serve signup still uses /api/auth/signup + verify-email.
        isEmailVerified: true,
        otpCode: null,
        otpExpiry: null,
        ...(defaultBranchId && { defaultBranchId })
      },
      include: {
        role: true // Include the role in the returned user object
      }
    });

    // Multi-business memberships (role per business).
    // Backward compatible: if membership tables aren't deployed yet, this block will no-op.
    const requestedMemberships = Array.isArray(body.memberships) ? body.memberships : null;
    const normalizedMemberships = (requestedMemberships && requestedMemberships.length > 0)
      ? requestedMemberships
      : [{ tenantId, roleId: body.role }];

    // Ensure current tenant membership exists
    if (!normalizedMemberships.some((m) => m?.tenantId === tenantId)) {
      normalizedMemberships.unshift({ tenantId, roleId: body.role });
    }

    // Validate requested tenant access (prevent indirect assignment / escalation)
    const finalMemberships = [];
    for (const m of normalizedMemberships) {
      const tId = String(m?.tenantId || '').trim();
      const rId = String(m?.roleId || '').trim();
      if (!tId || !rId) continue;
      // Only allow assigning tenants the current user can access
      const ok = await userHasAccessToTenant(currentUser, tId);
      if (ok) finalMemberships.push({ tenantId: tId, roleId: rId });
    }

    try {
      // Ensure role belongs to target tenant for each membership.
      for (const m of finalMemberships) {
        const role = await prisma.role.findFirst({
          where: { id: m.roleId, tenantId: m.tenantId },
          select: { id: true },
        });
        if (!role) {
          throw new Error('Invalid role assignment for selected business');
        }
      }

      // Create memberships
      await prisma.tenantMembership.createMany({
        data: finalMemberships.map((m) => ({
          userId: newUser.id,
          tenantId: m.tenantId,
          roleId: m.roleId,
          status: 'active',
        })),
        skipDuplicates: true,
      });

      // Keep legacy join table in sync for existing tenant switching logic.
      await prisma.user.update({
        where: { id: newUser.id },
        data: {
          tenants: {
            connect: finalMemberships.map((m) => ({ id: m.tenantId })),
          },
        },
        select: { id: true },
      });
    } catch (membershipWriteError) {
      console.warn('Skipping membership writes (legacy DB / not deployed yet):', membershipWriteError?.message || membershipWriteError);
    }

    // Assign allowed branches (user-branch separation)
    if (allowedBranchIds.length > 0 && newUser.id) {
      const validBranchIds = await prisma.branch.findMany({
        where: { id: { in: allowedBranchIds }, tenantId },
        select: { id: true }
      });
      const ids = validBranchIds.map((b) => b.id);
      if (ids.length > 0) {
        await prisma.userBranch.createMany({
          data: ids.map((branchId) => ({ userId: newUser.id, branchId }))
        });
      }
    }

    // Add a roleType string field for compatibility with code that expects role to be a string
    newUser.roleType = newUser.role?.name || 'user';
    
    // Send welcome email with password if sendEmail is true
    if (body.sendEmail) {
      try {
        // Import and use actual email service 
        const { sendEmail } = await import('@/lib/emailService');
        
        // Prepare email template with password instead of OTP
        const emailContent = {
          to: newUser.email,
          subject: 'Welcome to Our Platform - Your Account Details',
          template: 'welcome-email',
          data: {
            name: newUser.name,
            email: newUser.email,
            password: password, // Send the plain text password
            loginUrl: `${getPublicAppBaseUrlForEmail({
              forwardedProto: request.headers.get('x-forwarded-proto'),
              forwardedHost: request.headers.get('x-forwarded-host')
            })}/auth/login`
          }
        };
        
        // Send the actual email
        await sendEmail(emailContent);
        
        // Create audit log for email sent
        await prisma.auditLog.create({
          data: {
            action: 'WELCOME_EMAIL_SENT',
            entityType: 'USER',
            entityId: newUser.id,
            userId: currentUser.id,
            tenantId: currentUser.tenantId,
            details: JSON.stringify({
              recipientEmail: newUser.email,
              emailType: 'welcome-email'
            })
          }
        });
      } catch (emailError) {
        console.error('Error sending welcome email:', emailError);
        // Log the email error but continue with user creation
        await prisma.auditLog.create({
          data: {
            action: 'EMAIL_FAILED',
            entityType: 'USER',
            entityId: newUser.id,
            userId: currentUser.id,
            tenantId: currentUser.tenantId,
            details: JSON.stringify({
              error: emailError.message,
              recipientEmail: newUser.email,
              emailType: 'welcome-email'
            })
          }
        });
      }
    }
    
    // Return the created user (excluding password)
    const { password: _, ...userWithoutSensitiveInfo } = newUser;
    
    return NextResponse.json(
      { 
        message: 'User created successfully',
        user: userWithoutSensitiveInfo,
        // Only include temporary password in response if not sending email
        temporaryPassword: body.sendEmail ? undefined : password
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user. Please try again.' },
      { status: 500 }
    );
  }
}