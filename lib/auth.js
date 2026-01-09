// lib/auth.js
import { cookies } from 'next/headers';
import prisma from './prisma';

/**
 * Get the current logged-in user from the session cookie
 * @param {Request} request - The request object
 * @returns {Promise<Object|null>} The user object or null if not authenticated
 */
export async function getUserFromSession(request) {
  try {
    // Get session cookie - use await with cookies()
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie) {
      return null;
    }

    try {
      // Validate base64 string
      if (!sessionCookie.value || typeof sessionCookie.value !== 'string') {
        console.log('Invalid session cookie value');
        return null;
      }

      // Check if it's valid base64
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Regex.test(sessionCookie.value)) {
        console.log('Session cookie is not valid base64');
        return null;
      }

      // Decode and parse session data
      const decodedSession = Buffer.from(sessionCookie.value, 'base64').toString('utf8');
      
      if (!decodedSession || decodedSession.trim() === '') {
        console.log('Decoded session is empty');
        return null;
      }

      const sessionData = JSON.parse(decodedSession);
      
      if (!sessionData || !sessionData.userId) {
        console.log('Invalid session data structure');
        return null;
      }
      
      // Get user data from database
      const user = await prisma.user.findUnique({
        where: { id: sessionData.userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: {
            select: {
              id: true,
              name: true,
              permissions: true
            }
          },
          roleId: true,
          tenantId: true,
          isActive: true
        }
      });
      
      if (!user || !user.isActive) {
        return null;
      }
      
      return user;
    } catch (error) {
      console.error('Error parsing session:', error.message);
      console.error('Session cookie value:', sessionCookie.value?.substring(0, 50) + '...');
      return null;
    }
  } catch (error) {
    console.error('Error in getUserFromSession:', error);
    return null;
  }
}

/**
 * Check if a user has a specific permission
 * @param {Object} user - The user object
 * @param {string} permission - Permission string in format "category.action" (e.g., "expenses.create")
 * @returns {boolean} Whether the user has the permission
 */
export function hasPermission(user, permission) {
  if (!user || !user.role || !user.role.permissions) {
    return false;
  }
  
  // Split the permission string (e.g., "expenses.view" -> ["expenses", "view"])
  const [category, action] = permission.split('.');
  
  // Master admin has all permissions
  if (user.role.name === 'MASTER_ADMIN') {
    return true;
  }
  
  // Check if the user has the specified permission
  return user.role.permissions[category]?.[action] === true;
}

/**
 * Middleware to check if the user is authenticated
 * @param {Request} request - The request object
 * @returns {Promise<Response|null>} A response to redirect if not authenticated, null if authenticated
 */
export async function requireAuth(request) {
  const user = await getUserFromSession(request);
  
  if (!user) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  return null;
}

/**
 * Middleware to check if the user has a specific permission
 * @param {Request} request - The request object
 * @param {string} permission - Permission string in format "category.action"
 * @returns {Promise<Response|null>} A response to redirect if not authorized, null if authorized
 */
export async function requirePermission(request, permission) {
  const user = await getUserFromSession(request);
  
  if (!user) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  if (!hasPermission(user, permission)) {
    return new Response(JSON.stringify({ error: 'Permission denied' }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  return null;
}