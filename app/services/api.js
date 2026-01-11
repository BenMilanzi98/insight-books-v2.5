export const fetchUsers = async (params = {}) => {
  try {
    const { page, limit, sortBy, sortOrder, status, role, search } = params;
    
    // Build query string from params
    const queryParams = new URLSearchParams();
    if (page) queryParams.append('page', page);
    if (limit) queryParams.append('limit', limit);
    if (sortBy) queryParams.append('sortBy', sortBy);
    if (sortOrder) queryParams.append('sortOrder', sortOrder);
    if (status && status !== 'all') queryParams.append('status', status);
    if (role && role !== 'all') queryParams.append('role', role);
    if (search) queryParams.append('search', search);
    
    const queryString = queryParams.toString();
    const url = `/api/users${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Error fetching users: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};
  
  // Get a single user by ID
  export const fetchUserById = async (userId) => {
    try {
      const response = await fetch(`/api/users/get?id=${userId}`);
      
      if (!response.ok) {
        throw new Error(`Error fetching user: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching user ${userId}:`, error);
      throw error;
    }
  };
  
// Create a new user with proper tenant association
export const createUser = async (userData) => {
  try {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Error creating user: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};
  
  // Update an existing user
  export const updateUser = async (userId, userData) => {
    try {
      const response = await fetch('/api/users/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          ...userData
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Error updating user: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error updating user ${userId}:`, error);
      throw error;
    }
  };
  
  // Delete a user
  export const deleteUser = async (userId) => {
    try {
      const response = await fetch('/api/users/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle specific error cases
        if (errorData.error && errorData.error.includes('related records')) {
          throw new Error(`Cannot delete user: ${errorData.details || errorData.error}`);
        }
        
        throw new Error(`Error deleting user: ${errorData.error || response.statusText}`);
      }
      
      return true;
    } catch (error) {
      console.error(`Error deleting user ${userId}:`, error);
      throw error;
    }
  };

  // Deactivate a user (soft delete)
  export const deactivateUser = async (userId) => {
    try {
      const response = await fetch('/api/users/deactivate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Error deactivating user: ${errorData.error || response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error deactivating user ${userId}:`, error);
      throw error;
    }
  };

  // Reactivate a user
  export const reactivateUser = async (userId) => {
    try {
      const response = await fetch('/api/users/reactivate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Error reactivating user: ${errorData.error || response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error reactivating user ${userId}:`, error);
      throw error;
    }
  };
  
  // Send password reset email
  export const sendPasswordResetEmail = async (userId) => {
    try {
      // Generate a temporary password
      const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
      
      const response = await fetch('/api/users/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          newPassword: tempPassword,
          sendEmail: true
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Error resetting password: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error sending password reset email to user ${userId}:`, error);
      throw error;
    }
  };
  
  // Send email to user
  export const sendEmailToUser = async (userId, emailData) => {
    try {
      const response = await fetch('/api/users/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          ...emailData
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Error sending email: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error sending email to user ${userId}:`, error);
      throw error;
    }
  };
  
  /**
   * Role Management API functions
   */
  
  export const fetchRoles = async (params = {}) => {
    try {
      const { sortBy, sortOrder, search } = params;
      
      // Build query string from params
      const queryParams = new URLSearchParams();
      if (sortBy) queryParams.append('sortBy', sortBy);
      if (sortOrder) queryParams.append('sortOrder', sortOrder);
      if (search) queryParams.append('search', search);
      
      const queryString = queryParams.toString();
      const url = `/api/roles${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error fetching roles: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching roles:', error);
      // Return empty array to prevent UI crashes
      return [];
    }
  };
  
// Fetch a single role by ID with improved error handling
export const fetchRoleById = async (roleId) => {
  try {
    const response = await fetch(`/api/roles/get?id=${roleId}`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Error fetching role: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error fetching role ${roleId}:`, error);
    throw error;
  }
};
  
// Create a new role with proper tenant association
export const createRole = async (roleData) => {
  try {
    const response = await fetch('/api/roles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(roleData),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Error creating role: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating role:', error);
    throw error;
  }
};
  
// Update an existing role
export const updateRole = async (roleId, roleData) => {
  try {
    const response = await fetch('/api/roles/update', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        roleId,
        ...roleData
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Error updating role: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error updating role ${roleId}:`, error);
    throw error;
  }
};

  
// Delete a role
export const deleteRole = async (roleId) => {
  try {
    const response = await fetch('/api/roles/delete', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ roleId }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Error deleting role: ${response.statusText}`);
    }
    
    return true;
  } catch (error) {
    console.error(`Error deleting role ${roleId}:`, error);
    throw error;
  }
};
  
export const assignUsersToRole = async (roleId, userIds) => {
  try {
    const response = await fetch('/api/roles/assign-users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ roleId, userIds }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Error assigning users to role: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error assigning users to role ${roleId}:`, error);
    throw error;
  }
};
  
  /**
   * Export data functions
   */
  
  // Export users data (CSV)
  export const exportUsers = async (filters = {}) => {
    try {
      // Build query string from filters
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') queryParams.append(key, value);
      });
      
      const queryString = queryParams.toString();
      const url = `/api/users/export${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Error exporting users: ${response.statusText}`);
      }
      
      return response.blob();
    } catch (error) {
      console.error('Error exporting users:', error);
      throw error;
    }
  };
  
  // Export roles data (CSV)
  export const exportRoles = async () => {
    try {
      const response = await fetch('/api/roles/export');
      
      if (!response.ok) {
        throw new Error(`Error exporting roles: ${response.statusText}`);
      }
      
      return response.blob();
    } catch (error) {
      console.error('Error exporting roles:', error);
      throw error;
    }
  };

  // Add these functions to your inventoryService

// Upload a product image
export const uploadProductImage = async (imageFile, productId) => {
  try {
    const formData = new FormData();
    formData.append('file', imageFile);
    formData.append('productId', productId);
    
    const response = await fetch('/api/stock/upload-image', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`Error uploading image: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};

// Updated createProduct function to handle file uploads
export const createProduct = async (productData) => {
  try {
    // Extract the imageFile from productData
    const { imageFile, ...productDataWithoutImage } = productData;
    
    // First create the product
    const response = await fetch('/api/stock', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(productDataWithoutImage),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      // Create a custom error with the response data for better handling
      const error = new Error(errorData.error || `Error creating product: ${response.statusText}`);
      error.status = response.status;
      error.data = errorData;
      throw error;
    }
    
    const productResult = await response.json();
    
    // If we have an image file, upload it separately
    if (imageFile) {
      try {
        const imageResult = await uploadProductImage(imageFile, productResult.product.id);
        
        // Return the product with the updated image url
        return {
          ...productResult,
          product: {
            ...productResult.product,
            image: imageResult.imageUrl
          }
        };
      } catch (imageError) {
        console.error('Failed to upload image, but product was created:', imageError);
        // Return the product without the image update
        return productResult;
      }
    }
    
    // Return the product without image update
    return productResult;
  } catch (error) {
    console.error('Error creating product:', error);
    throw error;
  }
};

// Updated updateProduct function to handle file uploads
export const updateProduct = async (productId, productData) => {
  try {
    // Extract the imageFile from productData
    const { imageFile, ...productDataWithoutImage } = productData;
    
    // First update the product
    const response = await fetch(`/api/stock/${productId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(productDataWithoutImage),
    });
    
    if (!response.ok) {
      throw new Error(`Error updating product: ${response.statusText}`);
    }
    
    const productResult = await response.json();
    
    // If we have an image file, upload it separately
    if (imageFile) {
      try {
        const imageResult = await uploadProductImage(imageFile, productId);
        
        // Return the product with the updated image url
        return {
          ...productResult,
          product: {
            ...productResult.product,
            image: imageResult.imageUrl
          }
        };
      } catch (imageError) {
        console.error('Failed to upload image, but product was updated:', imageError);
        // Return the product without the image update
        return productResult;
      }
    }
    
    // Return the product without image update
    return productResult;
  } catch (error) {
    console.error(`Error updating product ${productId}:`, error);
    throw error;
  }
};