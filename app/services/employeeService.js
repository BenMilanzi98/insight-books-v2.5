// app/services/employeeService.js

// Fetch employees with optional filtering and pagination
export const fetchEmployees = async (params = {}) => {
  try {
    // Build query string from params
    const queryParams = new URLSearchParams();
    
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.search) queryParams.append('search', params.search);
    if (params.department) queryParams.append('department', params.department);
    if (params.status) queryParams.append('status', params.status);
    
    const response = await fetch(`/api/employees?${queryParams.toString()}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch employees');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error in fetchEmployees:', error);
    throw error;
  }
};

// Add a new employee
export const addEmployee = async (employeeData) => {
  try {
    const response = await fetch('/api/employees', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(employeeData),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { error: true, message: data.message || 'Failed to add employee' };
    }
    
    return data;
  } catch (error) {
    console.error('Error in addEmployee:', error);
    return { error: true, message: error.message || 'Network error occurred' };
  }
};

export const updateEmployee = async (employeeData) => {
  try {
    const response = await fetch(`/api/employees/${employeeData.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(employeeData),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { error: true, message: data.message || 'Failed to update employee' };
    }
    
    return data;
    
  } catch (error) {
    return { error: true, message: error.message || 'Network error occurred' };
  }
};