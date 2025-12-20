// app/services/dashboardService.js
export const fetchDashboardData = async (dateRange = 'month') => {
    try {
      const response = await fetch(`/api/dashboard?dateRange=${dateRange}`);
      
      if (!response.ok) {
        throw new Error(`Error fetching dashboard data: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      throw error;
    }
  };