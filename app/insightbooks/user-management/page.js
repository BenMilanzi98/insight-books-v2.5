"use client";
import { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Eye, 
  UserPlus,
  Shield,
  Mail,
  Phone,
  Calendar,
  Building,
  Users,
  Download,
  Upload,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';

export default function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [tenants, setTenants] = useState([]);
  const [roles, setRoles] = useState([]);
  const [branches, setBranches] = useState([]);

  // Fetch users from API
  const fetchUsers = async (page = 1, search = '', role = '', status = '') => {
    try {
      setLoading(true);
      setError('');
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: usersPerPage.toString()
      });
      
      if (search) params.append('search', search);
      if (role && role !== 'all') params.append('role', role);
      if (status && status !== 'all') params.append('status', status);

      const response = await fetch(`/api/admin/users?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      setUsers(data.users);
      setFilteredUsers(data.users);
      setTotalUsers(data.pagination.totalUsers);
      setTotalPages(data.pagination.totalPages);
      setCurrentPage(page);
      
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Failed to fetch users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch user statistics
  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const response = await fetch('/api/admin/users/stats');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setStats(data);
      
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch tenants for dropdown
  const fetchTenants = async () => {
    try {
      const response = await fetch('/api/admin/tenants');
      if (response.ok) {
        const data = await response.json();
        setTenants(data.tenants || []);
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
    }
  };

  // Fetch branches for a tenant (admin session — use admin API, not /api/branches which needs tenant user session)
  const fetchBranches = useCallback(async (tenantId) => {
    if (!tenantId) return;
    try {
      const response = await fetch(
        `/api/admin/branches?tenantId=${encodeURIComponent(tenantId)}&includeInactive=false`,
        { cache: 'no-store' }
      );
      if (response.ok) {
        const data = await response.json();
        setBranches(data.branches || []);
      } else {
        setBranches([]);
      }
    } catch (error) {
      console.error('Error fetching branches:', error);
      setBranches([]);
    }
  }, []);

  // Fetch roles for dropdown
  const fetchRoles = async () => {
    try {
      console.log('Fetching roles...');
      const response = await fetch('/api/admin/roles');
      console.log('Roles response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Roles data:', data);
        
        if (data.roles && data.roles.length > 0) {
          console.log('Setting roles from API:', data.roles);
          setRoles(data.roles);
        } else {
          console.log('No roles found, creating default roles...');
          // If no roles exist, create default roles
          await createDefaultRoles();
        }
      } else {
        console.log('Roles API not available, using fallback roles');
        // If roles API doesn't exist, use default roles
        setRoles([
          { id: 'user', name: 'User' },
          { id: 'manager', name: 'Manager' },
          { id: 'admin', name: 'Admin' }
        ]);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
      // Fallback to default roles
      setRoles([
        { id: 'user', name: 'User' },
        { id: 'manager', name: 'Manager' },
        { id: 'admin', name: 'Admin' }
      ]);
    }
  };

  // Create default roles if none exist
  const createDefaultRoles = async () => {
    try {
      console.log('Creating default roles...');
      console.log('Available tenants:', tenants);
      
      // Get the first tenant to create roles for
      if (tenants.length > 0) {
        const defaultTenant = tenants[0];
        console.log('Using default tenant:', defaultTenant);
        
        // Create default roles
        const defaultRoles = [
          { name: 'User', description: 'Basic user with limited permissions' },
          { name: 'Manager', description: 'Manager with elevated permissions' },
          { name: 'Admin', description: 'Administrator with full permissions' }
        ];

        const createdRoles = [];
        for (const roleData of defaultRoles) {
          console.log('Creating role:', roleData.name);
          const response = await fetch('/api/admin/roles', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ...roleData,
              tenantId: defaultTenant.id,
              permissions: {}
            }),
          });

          console.log('Role creation response status:', response.status);
          if (response.ok) {
            const result = await response.json();
            console.log('Role created:', result);
            createdRoles.push(result.role);
          } else {
            const errorText = await response.text();
            console.error('Failed to create role:', roleData.name, 'Status:', response.status, 'Error:', errorText);
          }
        }

        if (createdRoles.length > 0) {
          console.log('Setting created roles:', createdRoles);
          setRoles(createdRoles);
          console.log('Default roles created successfully');
        } else {
          console.log('No roles were created, using fallback');
          setRoles([
            { id: 'user', name: 'User' },
            { id: 'manager', name: 'Manager' },
            { id: 'admin', name: 'Admin' }
          ]);
        }
      } else {
        console.log('No tenants available, using fallback roles');
        setRoles([
          { id: 'user', name: 'User' },
          { id: 'manager', name: 'Manager' },
          { id: 'admin', name: 'Admin' }
        ]);
      }
    } catch (error) {
      console.error('Error creating default roles:', error);
      // Fallback to static roles
      setRoles([
        { id: 'user', name: 'User' },
        { id: 'manager', name: 'Manager' },
        { id: 'admin', name: 'Admin' }
      ]);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchUsers();
    fetchStats();
    fetchTenants();
  }, []);

  // Fetch roles after tenants are loaded
  useEffect(() => {
    if (tenants.length > 0) {
      fetchRoles();
    }
  }, [tenants]);

  // Filter users when search/filters change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchUsers(1, searchTerm, selectedRole, selectedStatus);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, selectedRole, selectedStatus]);

  // Handle pagination
  const handlePageChange = (page) => {
    fetchUsers(page, searchTerm, selectedRole, selectedStatus);
  };

  // Create new user
  const handleCreateUser = async (userData) => {
    try {
      setActionLoading(true);
      setError('');
      
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...userData,
          tenantId: userData.tenantId,
          password: userData.password || undefined
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create user');
      }

      const data = await response.json();
      if (data.temporaryPassword) {
        setSuccess(
          `User created successfully. Temporary password (6 characters): ${data.temporaryPassword} — copy and share securely with the user.`
        );
      } else {
        setSuccess('User created successfully!');
      }
      setShowCreateModal(false);
      
      // Refresh data
      fetchUsers(currentPage, searchTerm, selectedRole, selectedStatus);
      fetchStats();
      
      // Clear success message (longer when showing a one-time temp password)
      setTimeout(() => setSuccess(''), data.temporaryPassword ? 15000 : 3000);
      
    } catch (error) {
      console.error('Error creating user:', error);
      setError(error.message || 'Failed to create user. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Edit user
  const handleEditUser = async (userData) => {
    try {
      setActionLoading(true);
      setError('');
      
      console.log('Attempting to update user:', selectedUser.id);
      console.log('Update data:', userData);
      
      const response = await fetch(`/api/admin/users/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          ...userData,
          tenantId: userData.tenantId || userData.tenant
        }),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response not ok. Status:', response.status, 'Body:', errorText);
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      const responseText = await response.text();
      console.log('Raw response text:', responseText);
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Response that failed to parse:', responseText);
        throw new Error('Invalid response from server. Check console for details.');
      }

      console.log('Parsed result:', result);
      
      if (result.success) {
        setSuccess('User updated successfully!');
        setShowEditModal(false);
        setSelectedUser(null);
        
        // Refresh data
        fetchUsers(currentPage, searchTerm, selectedRole, selectedStatus);
        fetchStats();
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      } else {
        throw new Error(result.error || 'Failed to update user');
      }
      
    } catch (error) {
      console.error('Error updating user:', error);
      setError(error.message || 'Failed to update user. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete user
  const handleDeleteUser = async () => {
    try {
      setActionLoading(true);
      setError('');
      
      console.log('Attempting to delete user:', selectedUser.id);
      const response = await fetch(`/api/admin/users/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: selectedUser.id }),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response not ok. Status:', response.status, 'Body:', errorText);
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      const responseText = await response.text();
      console.log('Raw response text:', responseText);
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Response that failed to parse:', responseText);
        throw new Error('Invalid response from server. Check console for details.');
      }

      console.log('Parsed result:', result);
      
      if (result.success) {
        setSuccess('User deleted successfully!');
        setShowDeleteModal(false);
        setSelectedUser(null);
        
        // Refresh data
        fetchUsers(currentPage, searchTerm, selectedRole, selectedStatus);
        fetchStats();
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      } else {
        throw new Error(result.error || 'Failed to delete user');
      }
      
    } catch (error) {
      console.error('Error deleting user:', error);
      setError(error.message || 'Failed to delete user. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'manager': return 'bg-blue-100 text-blue-800';
      case 'user': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Error/Success Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
            <XCircle className="h-5 w-5 text-red-500" />
            <span className="text-red-700">{error}</span>
            <button
              onClick={() => setError('')}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span className="text-green-700">{success}</span>
            <button
              onClick={() => setSuccess('')}
              className="ml-auto text-green-400 hover:text-green-600"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
              <p className="text-gray-600 mt-2">Manage all users across your system</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <UserPlus size={20} />
                <span>Add User</span>
              </button>
              <button className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors">
                <Download size={20} />
                <span>Export</span>
              </button>
              <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors">
                <Upload size={20} />
                <span>Import</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {statsLoading ? '...' : stats.overview?.totalUsers || 0}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Shield className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Users</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {statsLoading ? '...' : stats.overview?.activeUsers || 0}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Building className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Tenants</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {statsLoading ? '...' : stats.overview?.uniqueTenants || 0}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">New This Month</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {statsLoading ? '...' : stats.growth?.usersThisMonth || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="user">User</option>
              </select>
              
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
              </select>
              
              <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg flex items-center justify-center space-x-2 transition-colors">
                <Filter size={16} />
                <span>More Filters</span>
              </button>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role & Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tenant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Activity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center space-y-2">
                        <Users className="h-12 w-12 text-gray-300" />
                        <p className="text-lg font-medium">No users found</p>
                        <p className="text-sm">Try adjusting your search or filters</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                              {user.avatar}
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{user.name}</div>
                            <div className="text-sm text-gray-500">ID: {user.id}</div>
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{user.email}</div>
                        <div className="text-sm text-gray-500">{user.phone || 'No phone'}</div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col space-y-2">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(user.role)}`}>
                            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                          </span>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(user.status)}`}>
                            {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                          </span>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{user.tenant}</div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDateTime(user.lastLogin)}
                        </div>
                        <div className="text-sm text-gray-500">
                          Joined {formatDate(user.createdAt)}
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setShowEditModal(true);
                              const tid =
                                user.tenantId ||
                                tenants.find((t) => t.name === user.tenant)?.id;
                              if (tid) fetchBranches(tid);
                            }}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                            title="Edit User"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setShowDeleteModal(true);
                            }}
                            className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                            title="Delete User"
                          >
                            <Trash2 size={16} />
                          </button>
                          <button className="text-gray-600 hover:text-gray-900 p-1 rounded hover:bg-gray-50" title="View Details">
                            <Eye size={16} />
                          </button>
                          <button className="text-gray-600 hover:text-gray-900 p-1 rounded hover:bg-gray-50" title="More Options">
                            <MoreVertical size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{((currentPage - 1) * usersPerPage) + 1}</span> to{' '}
                    <span className="font-medium">
                      {Math.min(currentPage * usersPerPage, totalUsers)}
                    </span>{' '}
                    of <span className="font-medium">{totalUsers}</span> results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          currentPage === page
                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <CreateUserModal
          onClose={() => {
            setShowCreateModal(false);
          }}
          onSubmit={handleCreateUser}
          loading={actionLoading}
          tenants={tenants}
          roles={roles}
        />
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <EditUserModal
          user={selectedUser}
          onClose={() => {
            setShowEditModal(false);
            setSelectedUser(null);
          }}
          onSubmit={handleEditUser}
          loading={actionLoading}
          tenants={tenants}
          roles={roles}
          branches={branches}
          onTenantChange={fetchBranches}
        />
      )}

      {/* Delete User Modal */}
      {showDeleteModal && selectedUser && (
        <DeleteUserModal
          user={selectedUser}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedUser(null);
          }}
          onConfirm={handleDeleteUser}
          loading={actionLoading}
        />
      )}
    </div>
  );
}

// Create User Modal Component
function CreateUserModal({ onClose, onSubmit, loading, tenants, roles }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    status: 'active',
    tenantId: '',
    password: '',
    department: '',
    defaultBranchId: '',
    allowedBranchIds: []
  });
  const [modalBranches, setModalBranches] = useState([]);
  const [modalDepartments, setModalDepartments] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [showNewDepartment, setShowNewDepartment] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [addingDepartment, setAddingDepartment] = useState(false);

  // Fetch branches and departments when tenant changes
  useEffect(() => {
    if (!formData.tenantId) {
      setModalBranches([]);
      setModalDepartments([]);
      setFormData((prev) => ({ ...prev, defaultBranchId: '', allowedBranchIds: [] }));
      return;
    }
    const fetchBranches = async () => {
      setBranchesLoading(true);
      try {
        const res = await fetch(`/api/admin/branches?tenantId=${formData.tenantId}`, { cache: 'no-store' });
        const data = await res.json();
        setModalBranches(data.branches || []);
      } catch (e) {
        setModalBranches([]);
      } finally {
        setBranchesLoading(false);
      }
    };
    const fetchDepartments = async () => {
      setDepartmentsLoading(true);
      try {
        const res = await fetch(`/api/admin/departments?tenantId=${formData.tenantId}`, { cache: 'no-store' });
        const data = await res.json();
        setModalDepartments(Array.isArray(data) ? data : []);
      } catch (e) {
        setModalDepartments([]);
      } finally {
        setDepartmentsLoading(false);
      }
    };
    fetchBranches();
    fetchDepartments();
  }, [formData.tenantId]);

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: '',
      status: 'active',
      tenantId: '',
      password: '',
      department: '',
      defaultBranchId: '',
      allowedBranchIds: []
    });
    setShowNewDepartment(false);
    setNewDepartmentName('');
  };

  const handleAddDepartment = async () => {
    const name = newDepartmentName.trim();
    if (!name || !formData.tenantId) return;
    setAddingDepartment(true);
    try {
      const res = await fetch('/api/admin/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: formData.tenantId, name })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create department');
      setModalDepartments((prev) => [...prev, data]);
      setFormData((prev) => ({ ...prev, department: data.name }));
      setNewDepartmentName('');
      setShowNewDepartment(false);
    } catch (e) {
      alert(e.message || 'Could not create department');
    } finally {
      setAddingDepartment(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.role || !formData.tenantId) {
      alert('Please fill in all required fields');
      return;
    }
    const payload = {
      ...formData,
      department: formData.department || undefined,
      defaultBranchId: formData.defaultBranchId || undefined,
      allowedBranchIds: Array.isArray(formData.allowedBranchIds) ? formData.allowedBranchIds : []
    };
    onSubmit(payload);
  };

  const tenantBranches = modalBranches.filter((b) => b.tenantId === formData.tenantId || !b.tenantId);

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border max-w-md w-full shadow-lg rounded-md bg-white mb-10">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Create New User</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Password (optional)</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Leave blank for auto-generated password"
              />
              <p className="mt-1 text-xs text-gray-500">
                Leave blank to auto-generate a random 6-character password (letters and numbers). It is shown once after create if email is not used.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={roles.length === 0}
              >
                <option value="">{roles.length === 0 ? 'Loading roles...' : 'Select a role'}</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Tenant</label>
              <select
                value={formData.tenantId}
                onChange={(e) => setFormData({ ...formData, tenantId: e.target.value, department: '', defaultBranchId: '', allowedBranchIds: [] })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select a tenant</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>{tenant.name} ({tenant.subdomain})</option>
                ))}
              </select>
            </div>

            {/* Department */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Department (optional)</label>
              {formData.tenantId && (
                <>
                  <select
                    value={showNewDepartment ? '__new__' : (formData.department || '')}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '__new__') {
                        setShowNewDepartment(true);
                        setFormData((prev) => ({ ...prev, department: '' }));
                      } else {
                        setShowNewDepartment(false);
                        setFormData((prev) => ({ ...prev, department: v }));
                      }
                    }}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    disabled={departmentsLoading}
                  >
                    <option value="">No department</option>
                    {modalDepartments.map((d) => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                    <option value="__new__">+ Create new department</option>
                  </select>
                  {showNewDepartment && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={newDepartmentName}
                        onChange={(e) => setNewDepartmentName(e.target.value)}
                        placeholder="New department name"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddDepartment}
                        disabled={addingDepartment || !newDepartmentName.trim()}
                        className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                      >
                        {addingDepartment ? 'Adding...' : 'Add'}
                      </button>
                    </div>
                  )}
                </>
              )}
              {!formData.tenantId && (
                <p className="mt-1 text-xs text-gray-500">Select a tenant first</p>
              )}
            </div>

            {/* Default branch */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Default branch (optional)</label>
              {formData.tenantId && (
                <select
                  value={formData.defaultBranchId || ''}
                  onChange={(e) => setFormData({ ...formData, defaultBranchId: e.target.value || null })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  disabled={branchesLoading}
                >
                  <option value="">None</option>
                  {tenantBranches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}{b.code ? ` (${b.code})` : ''}</option>
                  ))}
                </select>
              )}
              <p className="mt-1 text-xs text-gray-500">Login and transactions default to this branch when not specified</p>
            </div>

            {/* Allowed branches */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Allowed branches (optional)</label>
              <p className="mt-1 text-xs text-gray-500 mb-2">Leave empty for access to all branches. Select specific branches to restrict this user.</p>
              {formData.tenantId && tenantBranches.length > 0 && (
                <div className="space-y-1 max-h-32 overflow-y-auto border border-gray-200 rounded p-2">
                  {tenantBranches.map((branch) => (
                    <label key={branch.id} className="flex items-center gap-2 py-1">
                      <input
                        type="checkbox"
                        checked={formData.allowedBranchIds.includes(branch.id)}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            allowedBranchIds: e.target.checked
                              ? [...formData.allowedBranchIds, branch.id]
                              : formData.allowedBranchIds.filter((id) => id !== branch.id)
                          })
                        }
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm">{branch.name}{branch.code ? ` (${branch.code})` : ''}</span>
                    </label>
                  ))}
                </div>
              )}
              {formData.tenantId && tenantBranches.length === 0 && !branchesLoading && (
                <p className="text-xs text-gray-500">No branches for this tenant</p>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => { resetForm(); onClose(); }}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Creating...</span>
                  </>
                ) : (
                  <span>Create User</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Edit User Modal Component
function EditUserModal({ user, onClose, onSubmit, loading, tenants, roles, branches, onTenantChange }) {
  // Find the tenant ID for the current user (prefer user.tenantId from API)
  const findTenantId = (tenantName) => {
    if (user.tenantId) return user.tenantId;
    const tenant = tenants.find(t => t.name === tenantName);
    return tenant ? tenant.id : '';
  };

  // Find the role ID for the current user (prefer user.roleId from API)
  const findRoleId = (roleName) => {
    if (user.roleId) return user.roleId;
    const role = roles.find(r => r.name === roleName);
    return role ? role.id : roleName;
  };

  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    role: findRoleId(user.role),
    status: user.status,
    tenantId: findTenantId(user.tenant),
    defaultBranchId: user.defaultBranchId || null,
    allowedBranchIds: Array.isArray(user.allowedBranchIds) ? [...user.allowedBranchIds] : []
  });

  // Load branches when tenant changes (onTenantChange is stable via useCallback on parent)
  useEffect(() => {
    if (formData.tenantId && onTenantChange) {
      onTenantChange(formData.tenantId);
    }
  }, [formData.tenantId, onTenantChange]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.name || !formData.email || !formData.role || !formData.tenantId) {
      alert('Please fill in all required fields');
      return;
    }
    
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Edit User</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select a role</option>
                {roles.map(role => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Tenant</label>
              <select
                value={formData.tenantId}
                onChange={(e) => {
                  setFormData({...formData, tenantId: e.target.value, defaultBranchId: null});
                  if (onTenantChange) onTenantChange(e.target.value);
                }}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select a tenant</option>
                {tenants.map(tenant => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} ({tenant.subdomain})
                  </option>
                ))}
              </select>
            </div>
            
            {formData.tenantId && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Default Branch (Optional)</label>
                  <select
                    value={formData.defaultBranchId || ''}
                    onChange={(e) => setFormData({...formData, defaultBranchId: e.target.value || null})}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">-- No Default Branch --</option>
                    {branches.filter(b => b.tenantId === formData.tenantId || !b.tenantId).map(branch => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name} {branch.code ? `(${branch.code})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">Login and transactions default to this branch when not specified</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Allowed Branches</label>
                  <p className="mt-1 text-xs text-gray-500 mb-2">Leave empty for access to all branches. Select specific branches to restrict this user.</p>
                  <div className="mt-1 border border-gray-300 rounded-md p-2 max-h-32 overflow-y-auto bg-gray-50">
                    {branches.filter(b => b.tenantId === formData.tenantId || !b.tenantId).map(branch => (
                      <label key={branch.id} className="flex items-center gap-2 py-1">
                        <input
                          type="checkbox"
                          checked={formData.allowedBranchIds.includes(branch.id)}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...formData.allowedBranchIds, branch.id]
                              : formData.allowedBranchIds.filter(id => id !== branch.id);
                            setFormData({ ...formData, allowedBranchIds: next });
                          }}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">{branch.name}{branch.code ? ` (${branch.code})` : ''}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
            
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Updating...</span>
                  </>
                ) : (
                  <span>Update User</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Delete User Modal Component
function DeleteUserModal({ user, onClose, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <Trash2 className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mt-4">Delete User</h3>
          <p className="text-sm text-gray-500 mt-2">
            Are you sure you want to delete <strong>{user.name}</strong>? This action cannot be undone.
          </p>
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-xs text-yellow-800">
              <strong>⚠️ Warning:</strong> This will also delete all associated data including:
            </p>
            <ul className="text-xs text-yellow-700 mt-1 ml-4 list-disc">
              <li>User audit logs</li>
              <li>Expenses and attachments</li>
              <li>Invoices and quotations</li>
              <li>Sales records</li>
              <li>Inventory transactions</li>
              <li>All other user-related data</li>
            </ul>
          </div>
          <div className="flex justify-center space-x-3 mt-6">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Deleting...</span>
                </>
              ) : (
                <span>Delete User</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 