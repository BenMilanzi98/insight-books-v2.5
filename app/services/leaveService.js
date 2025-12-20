// app/services/leaveService.js

// Fetch leave requests with optional filters and pagination
export const fetchLeaveRequests = async (params = {}) => {
    try {
      const { page, limit, sortBy, sortOrder, status, employeeId, type, from, to } = params;
      
      // Build query string from params
      const queryParams = new URLSearchParams();
      if (page) queryParams.append('page', page);
      if (limit) queryParams.append('limit', limit);
      if (sortBy) queryParams.append('sortBy', sortBy);
      if (sortOrder) queryParams.append('sortOrder', sortOrder);
      if (status && status !== 'All') queryParams.append('status', status);
      if (employeeId) queryParams.append('employeeId', employeeId);
      if (type && type !== 'All') queryParams.append('type', type);
      if (from) queryParams.append('from', from);
      if (to) queryParams.append('to', to);
      
      const queryString = queryParams.toString();
      const url = `/api/leave${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error fetching leave requests: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      throw error;
    }
  };
  
  // Get a single leave request by ID
  export const fetchLeaveRequestById = async (leaveId) => {
    try {
      const response = await fetch(`/api/leave/${leaveId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error fetching leave request: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching leave request ${leaveId}:`, error);
      throw error;
    }
  };
  
  // Create a new leave request
  export const createLeaveRequest = async (leaveData) => {
    try {
      const response = await fetch('/api/leave', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(leaveData),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error creating leave request: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating leave request:', error);
      throw error;
    }
  };
  
  // Update an existing leave request
  export const updateLeaveRequest = async (leaveId, leaveData) => {
    try {
      const response = await fetch(`/api/leave/${leaveId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(leaveData),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error updating leave request: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error updating leave request ${leaveId}:`, error);
      throw error;
    }
  };
  
  // Cancel a leave request
  export const cancelLeaveRequest = async (leaveId) => {
    try {
      const response = await fetch(`/api/leave/${leaveId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error cancelling leave request: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error cancelling leave request ${leaveId}:`, error);
      throw error;
    }
  };
  
  // Approve a leave request
  export const approveLeaveRequest = async (leaveId) => {
    try {
      const response = await fetch(`/api/leave/${leaveId}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error approving leave request: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error approving leave request ${leaveId}:`, error);
      throw error;
    }
  };
  
  // Reject a leave request
  export const rejectLeaveRequest = async (leaveId, reason) => {
    try {
      const response = await fetch(`/api/leave/${leaveId}/reject`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error rejecting leave request: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error rejecting leave request ${leaveId}:`, error);
      throw error;
    }
  };
  
  // Get leave statistics (pending, approved, current)
  export const getLeaveStatistics = async () => {
    try {
      const response = await fetch('/api/leave/statistics');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error fetching leave statistics: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching leave statistics:', error);
      throw error;
    }
  };
  
  // Get leave balance for an employee
  export const getEmployeeLeaveBalance = async (employeeId) => {
    try {
      const response = await fetch(`/api/leave/balance/${employeeId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error fetching leave balance: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching leave balance for employee ${employeeId}:`, error);
      throw error;
    }
  };