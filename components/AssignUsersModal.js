// AssignUsersModal.js - Component for assigning users to a role
import { useState, useEffect } from "react";
import { X, Search, Check, User, AlertCircle, Loader } from "lucide-react";
import { fetchUsers, assignUsersToRole } from "@/app/services/api";

const AssignUsersModal = ({ isOpen, onClose, roleId, roleName, onSuccess }) => {
  // States
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Fetch users on component mount
  useEffect(() => {
    if (isOpen) {
      fetchAvailableUsers();
    }
  }, [isOpen]);

  // Filter users based on search term
  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredUsers(users);
    } else {
      const lowercasedSearch = searchTerm.toLowerCase();
      setFilteredUsers(
        users.filter(
          user =>
            user.name.toLowerCase().includes(lowercasedSearch) ||
            user.email.toLowerCase().includes(lowercasedSearch)
        )
      );
    }
  }, [searchTerm, users]);

  // Fetch available users
  const fetchAvailableUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all users for the current tenant
      const response = await fetchUsers({ limit: 100 });
      if (response.users) {
        setUsers(response.users);
        setFilteredUsers(response.users);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
      setError("Failed to load users. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Toggle user selection
  const toggleUserSelection = (userId) => {
    setSelectedUserIds(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  // Select all users
  const selectAllUsers = () => {
    const allUserIds = filteredUsers.map(user => user.id);
    setSelectedUserIds(allUserIds);
  };

  // Deselect all users
  const deselectAllUsers = () => {
    setSelectedUserIds([]);
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Submit assigned users
  const handleSubmit = async () => {
    if (selectedUserIds.length === 0) {
      setError("Please select at least one user to assign to this role.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Call API to assign users to role
      await assignUsersToRole(roleId, selectedUserIds);
      
      // Notify parent component and close modal
      if (onSuccess) onSuccess();
      onClose();
      
    } catch (err) {
      console.error("Error assigning users to role:", err);
      setError(err.message || "Failed to assign users to role. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Render empty state if not open
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Assign Users to Role: {roleName}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 focus:outline-none"
          >
            <span className="sr-only">Close</span>
            <X size={20} />
          </button>
        </div>

        {/* Search and controls */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search users..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </div>
          
          <div className="flex justify-between mt-2">
            <div className="text-sm text-gray-500">
              {selectedUserIds.length} of {filteredUsers.length} users selected
            </div>
            <div className="flex space-x-2">
              <button
                type="button"
                className="text-sm text-blue-600 hover:text-blue-800"
                onClick={selectAllUsers}
              >
                Select All
              </button>
              <button
                type="button"
                className="text-sm text-blue-600 hover:text-blue-800"
                onClick={deselectAllUsers}
              >
                Deselect All
              </button>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-50 text-red-700 rounded-md flex items-start">
            <AlertCircle size={16} className="mr-2 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* User list */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <Loader size={24} className="animate-spin text-blue-600" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-gray-500">
              <User size={24} className="text-gray-400 mb-2" />
              <p className="mb-2">No users found</p>
              <p className="text-sm text-gray-400">Try adjusting your search</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map(user => (
                <div
                  key={user.id}
                  className={`p-3 rounded-md flex items-center hover:bg-gray-50 cursor-pointer ${
                    selectedUserIds.includes(user.id) ? 'bg-blue-50 border border-blue-200' : 'border border-gray-200'
                  }`}
                  onClick={() => toggleUserSelection(user.id)}
                >
                  <div className={`w-6 h-6 rounded-md border flex items-center justify-center mr-3 ${
                    selectedUserIds.includes(user.id) 
                      ? 'bg-blue-600 border-blue-600' 
                      : 'border-gray-300'
                  }`}>
                    {selectedUserIds.includes(user.id) && (
                      <Check size={14} className="text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{user.name}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </div>
                  <div className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-800">
                    {typeof user.role === 'string' 
                      ? user.role 
                      : user.role?.name || user.roleType || 'User'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with actions */}
        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center"
            onClick={handleSubmit}
            disabled={saving || selectedUserIds.length === 0}
          >
            {saving ? (
              <>
                <Loader size={16} className="animate-spin mr-2" />
                Assigning...
              </>
            ) : (
              'Assign Users'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignUsersModal;