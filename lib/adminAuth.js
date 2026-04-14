import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/serverJwtSecret';
import prisma from './prisma';

/**
 * Verify admin JWT string (shared by App Router and Pages API).
 * @param {string|undefined|null} token
 * @returns {Promise<Object|null>}
 */
export async function verifyAdminJwtToken(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }
  try {
    const decoded = jwt.verify(
      token,
      getJwtSecret()
    );

    if (!decoded.isAdmin) {
      return null;
    }

    const admin = await prisma.admin.findUnique({
      where: { id: decoded.adminId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        permissions: true,
        isActive: true,
      },
    });

    if (!admin || !admin.isActive) {
      return null;
    }

    return admin;
  } catch (error) {
    console.error('Admin auth verification error:', error);
    return null;
  }
}

/**
 * Verify admin authentication from cookies
 * @param {Request} request - The request object
 * @returns {Promise<Object|null>} The admin object or null if not authenticated
 */
export async function verifyAdminAuth(request) {
  const adminToken = request.cookies.get('admin_token');
  if (!adminToken) {
    return null;
  }
  return verifyAdminJwtToken(adminToken.value);
}

/**
 * Check if admin has specific permission
 * @param {Object} admin - The admin object
 * @param {string} permission - Permission string in format "category.action"
 * @returns {boolean} Whether the admin has the permission
 */
export function adminHasPermission(admin, permission) {
  if (!admin || !admin.permissions) {
    return false;
  }

  // Super Admin has all permissions
  if (admin.role === 'Super Admin') {
    return true;
  }

  // Check specific permission
  const [category, action] = permission.split('.');
  return admin.permissions[category]?.[action] === true;
}

/**
 * Require admin authentication middleware
 * @param {Request} request - The request object
 * @returns {Promise<Response|null>} A response to redirect if not authenticated, null if authenticated
 */
export async function requireAdminAuth(request) {
  const admin = await verifyAdminAuth(request);
  
  if (!admin) {
    return new Response(JSON.stringify({ error: 'Admin authentication required' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  return null;
}

/**
 * Require admin permission middleware
 * @param {Request} request - The request object
 * @param {string} permission - Permission string in format "category.action"
 * @returns {Promise<Response|null>} A response to redirect if not authorized, null if authorized
 */
export async function requireAdminPermission(request, permission) {
  const admin = await verifyAdminAuth(request);
  
  if (!admin) {
    return new Response(JSON.stringify({ error: 'Admin authentication required' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  if (!adminHasPermission(admin, permission)) {
    return new Response(JSON.stringify({ error: 'Insufficient admin privileges' }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  return null;
}

/**
 * Get admin from request (for use in API routes)
 * @param {Request} request - The request object
 * @returns {Promise<Object|null>} The admin object or null
 */
export async function getAdminFromRequest(request) {
  return await verifyAdminAuth(request);
} 