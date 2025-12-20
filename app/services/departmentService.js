// Fetch departments with optional filtering
export const getDepartments = async (params = {}) => {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.search) queryParams.append('search', params.search);
      
      const response = await fetch(`/api/departments?${queryParams.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch departments');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error in fetchDepartments:', error);
      throw error;
    }
  };
  
  // Add a new department
  export const createDepartment = async (departmentData) => {
    try {
      const response = await fetch('/api/departments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(departmentData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return { error: true, message: data.message || 'Failed to add department' };
      }
      
      return data;
    } catch (error) {
      console.error('Error in addDepartment:', error);
      return { error: true, message: error.message || 'Network error occurred' };
    }
  };
  
  export const updateDepartment = async (departmentData) => {
    try {
      const response = await fetch(`/api/departments/${departmentData.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(departmentData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return { error: true, message: data.message || 'Failed to update department' };
      }
      
      return data;
    } catch (error) {
      return { error: true, message: error.message || 'Network error occurred' };
    }
  };
  
  export const deleteDepartment = async (id) => {
    try {
      const response = await fetch(`/api/departments/${id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return { error: true, message: data.message || 'Failed to delete department' };
      }
      
      return data;
    } catch (error) {
      return { error: true, message: error.message || 'Network error occurred' };
    }
  };