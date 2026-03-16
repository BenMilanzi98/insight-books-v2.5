// app/api/users/route.js - Modified to ensure tenant isolation
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { getUserFromSession } from '@/lib/auth';

// GET - Fetch users with filtering, sorting, and pagination
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
    
    // Check if email is already registered
    const existingUser = await prisma.user.findUnique({
      where: { email: body.email }
    });
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email is already registered' },
        { status: 400 }
      );
    }
    
    // Generate a random password if not provided
    let password = body.password;
    if (!password) {
      // Generate a secure random password
      password = Math.random().toString(36).slice(-8) + 
                 Math.random().toString(36).toUpperCase().slice(-4) + 
                 Math.floor(Math.random() * 10) + 
                 "!";
    }
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    
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
            id: currentUser.tenantId // Connect to the tenant using the ID
          }
        },
        department: body.department || null,
        status: body.status || 'active',
        isEmailVerified: false // Require email verification
      },
      include: {
        role: true // Include the role in the returned user object
      }
    });
    
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
            loginUrl: `https://insightbooksafrica.com/login`
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