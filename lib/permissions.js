// lib/permissions.js
let cachedUser = null;

export const getCurrentUser = async () => {
  if (cachedUser) return cachedUser;

  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) throw new Error('Failed to fetch user');
    cachedUser = await res.json();
  } catch (err) {
    console.error('Error fetching user:', err);
    cachedUser = {
      name: 'Guest',
      role: {
        name: 'Guest',
        permissions: {},
      },
    };
  }

  return cachedUser;
};

export const hasPermission = (permissions, permission) => {
  if (!permissions || !permission) return false;

  if (permissions[permission] === true) return true;

  if (typeof permission !== 'string' || !permission.includes('.')) {
    return false;
  }

  const [category, action] = permission.split('.');
  if (!category || !action) return false;

  return permissions?.[category]?.[action] === true;
};


export const checkPermission = async (permission) => {
  const user = await getCurrentUser();
  return hasPermission(user?.role?.permissions, permission);
};

export const getPermission = async(permission) => {
  if (!cachedUser) {  
    await getCurrentUser();    
    return hasPermission(cachedUser?.role?.permissions, permission);
  } 
  return hasPermission(cachedUser?.role?.permissions, permission);
};

