"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Search, 
  Plus, 
  MoreVertical, 
  Filter, 
  Download, 
  RefreshCw, 
  Edit, 
  Trash2, 
  Lock, 
  Mail, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Shield,
  User,
  Users,
  ChevronDown,
  Eye,
  ArrowUpDown,
  Loader,
  X,
} from "lucide-react";
import * as api from '@/app/services/api'; // Import the API service
import AssignUsersModal from '@/components/AssignUsersModal';
import PermissionGuard from "@/components/PermissionGuard";
import { getPermission } from "@/lib/permissions";

// Components
const Skeleton = ({ className = "", ...props }) => {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded ${className}`}
      {...props}
    />
  );
};
// Permission modules and actions for our permission system
const permissionModules = {
  dashboard: { 
    label: 'Dashboard',
    actions: ['view']
  },
  users: { 
    label: 'User Management',
    actions: ['create', 'view', 'update', 'delete', 'export']
  },
  roles: {
    label: 'Role Management',
    actions: ['create', 'view', 'update', 'delete', 'assign']
  },
  system: {
    label: 'System Customization',
    actions: ['view', 'update']
  }, 
  // Additional modules for comprehensive system coverage
  clients: { label: 'Client Management', actions: ['create', 'view', 'update', 'delete', 'export'] },
  sales: { label: 'POS', actions: ['create', 'view', 'update', 'delete', 'void', 'refund', 'export'] },
  quotations: { label: 'Quotations', actions: ['create', 'view', 'update', 'delete', 'convert', 'approve', 'export'] },
  invoices: { label: 'Invoicing', actions: ['create', 'view', 'update', 'delete', 'send', 'markAsPaid', 'export'] },
  expenses: { label: 'Expense Tracking', actions: ['create', 'view', 'update', 'delete', 'approve', 'export'] },
  payments: { label: 'Payment Processing', actions: ['create', 'view', 'update', 'delete', 'export'] },
  reports: { label: 'Financial Reporting', actions: ['view', 'export'] },
  inventory: { label: 'Stock Management', actions: ['create', 'view', 'update', 'delete', 'adjust', 'export'] },
  hr: { label: 'HR Management', actions: ['create', 'view', 'update', 'delete', 'export'] },
  payroll: { label: 'Payroll', actions: ['create', 'view', 'update', 'delete', 'process', 'export'] },
  tax: { label: 'Tax Management', actions: ['view', 'update', 'export'] },
  generalLedger: { label: 'General Ledger', actions: ['view', 'export'] },
  journalEntries: { label: 'Journal Entries', actions: ['create', 'view', 'update', 'delete', 'post', 'export'] },
  accounts: { label: 'Chart of Accounts', actions: ['create', 'view', 'update', 'delete', 'export'] },
  trialBalance: { label: 'Trial Balance', actions: ['view', 'export'] }
};
// Format date for display
const formatDate = (dateString) => {
  if (!dateString) return "—";
  try {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  } catch (error) {
    return "—";
  }
};

// Format time ago
const formatTimeAgo = (timestamp) => {
  if (!timestamp) return "Never";
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffSeconds = Math.floor((now - date) / 1000);
  
  if (diffSeconds < 60) return "Just now";
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} minutes ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} hours ago`;
  if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)} days ago`;
  
  return formatDate(timestamp);
};

// Status badge component
const StatusBadge = ({ status, statusConfig }) => {
  const config = statusConfig[status] || statusConfig.default;
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {config.icon}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

// Toast notification component
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [onClose]);
  
  const bgColor = type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 
                  type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
                  'bg-blue-50 border-blue-200 text-blue-800';
  
  const Icon = type === 'success' ? CheckCircle : 
               type === 'error' ? XCircle : 
               AlertCircle;
  
  return (
    <div className={`fixed bottom-4 right-4 p-4 rounded-md border ${bgColor} shadow-md flex items-start z-50`}>
      <Icon size={18} className="mr-2 flex-shrink-0 mt-0.5" />
      <div>{message}</div>
      <button 
        onClick={onClose} 
        className="ml-4 text-gray-500 hover:text-gray-800"
      >
        &times;
      </button>
    </div>
  );
};

// Default configurations
const defaultConfig = {
  // Page header configuration
  header: {
    title: "User & Role Management",
    description: "Manage users, assign roles, and control access permissions for your organization"
  },
  
  // Tab configuration
  tabs: {
    users: {
      label: "Users",
      icon: <Users size={18} />,
      enabled: true
    },
    roles: {
      label: "Roles & Permissions",
      icon: <Shield size={18} />,
      enabled: true
    }
  },
  
  // Filter options
  filters: {
    status: {
      enabled: true,
      options: ["all", "active", "inactive", "pending"]
    },
    role: {
      enabled: true
    }
  },
  
  // Table configurations
  tables: {
    users: {
      columns: [
        { key: "name", label: "Name", sortable: true },
        { key: "email", label: "Email", sortable: true },
        { key: "role", label: "Role", sortable: true },
        { key: "department", label: "Department", sortable: true },
        { key: "status", label: "Status", sortable: true },
        { key: "lastLogin", label: "Last Login", sortable: true },
        { key: "createdAt", label: "Created", sortable: true }
      ]
    },
    roles: {
      columns: [
        { key: "name", label: "Role Name", sortable: true },
        { key: "description", label: "Description", sortable: true },
        { key: "users", label: "Users", sortable: true },
        { key: "permissions", label: "Key Permissions", sortable: false }
      ]
    }
  },
  
  // Actions configuration
  actions: {
    addUser: {
      enabled: true,
      label: "Add User"
    },
    addRole: {
      enabled: true,
      label: "Add Role"
    },
    export: {
      enabled: true,
      label: "Export"
    },
    refresh: {
      enabled: true,
      label: "Refresh"
    },
    userActions: {
      view: { enabled: true, label: "View Details" },
      edit: { enabled: true, label: "Edit User" },
      email: { enabled: true, label: "Send Email" },
      resetPassword: { enabled: true, label: "Reset Password" },
      delete: { enabled: true, label: "Delete User" }
    },
    roleActions: {
      view: { enabled: true, label: "View Details" },
      edit: { enabled: true, label: "Edit Role" },
      assignUsers: { enabled: true, label: "Assign Users" },
      delete: { enabled: true, label: "Delete Role" }
    }
  },
  
  // Status configuration
  statusConfig: {
    active: { 
      color: "bg-emerald-100 text-emerald-800", 
      icon: <CheckCircle size={14} className="mr-1" /> 
    },
    inactive: { 
      color: "bg-gray-100 text-gray-800", 
      icon: <XCircle size={14} className="mr-1" /> 
    },
    pending: { 
      color: "bg-amber-100 text-amber-800", 
      icon: <AlertCircle size={14} className="mr-1" /> 
    },
    default: { 
      color: "bg-gray-100 text-gray-800", 
      icon: <AlertCircle size={14} className="mr-1" /> 
    }
  },
  
  // Modal configurations
  modals: {
    viewUser: {
      enabled: true,
      title: "User Details"
    },
    viewRole: {
      enabled: true,
      title: "Role Details"
    },
    addUser: {
      enabled: true,
      title: "Add New User",
      fields: [
        { key: "firstName", label: "First Name", type: "text", required: true },
        { key: "lastName", label: "Last Name", type: "text", required: true },
        { key: "email", label: "Email Address", type: "email", required: true, fullWidth: true },
        { key: "role", label: "Role", type: "select", options: "roles", required: true },
        { key: "department", label: "Department", type: "text" },
        { key: "status", label: "Status", type: "select", options: ["active", "inactive", "pending"], defaultValue: "active" },
        { key: "sendEmail", label: "Send Welcome Email", type: "toggle", defaultValue: true }
      ]
    },
    addRole: {
      enabled: true,
      title: "Add New Role",
      fields: [
        { key: "name", label: "Role Name", type: "text", required: true, fullWidth: true },
        { key: "description", label: "Description", type: "textarea", required: true, fullWidth: true }
      ],
      permissionCategories: [
        { 
          key: "users", 
          title: "User Management",
          permissions: ["view", "create", "edit", "delete"]
        },
        { 
          key: "invoices", 
          title: "Invoices",
          permissions: ["view", "create", "edit", "delete"]
        },
        { 
          key: "reports", 
          title: "Reports",
          permissions: ["view", "create", "export"]
        },
        { 
          key: "settings", 
          title: "Settings",
          permissions: ["view", "edit"]
        }
      ]
    }
  },
  
  // Callbacks
  callbacks: {
    onUserAdd: null,
    onUserEdit: null,
    onUserDelete: null,
    onRoleAdd: null,
    onRoleEdit: null,
    onRoleDelete: null,
    onExport: null,
    onRefresh: null,
    onFilterChange: null,
    onSearchChange: null,
    onSort: null
  },
  
  // Pagination
  pagination: {
    enabled: true,
    itemsPerPage: 10,
    showTotalItems: true
  }
};

// UsersTable Component
const UsersTable = ({ 
  usersData, 
  loading, 
  error, 
  columns, 
  statusConfig, 
  actions, 
  actionMenuOpen, 
  onToggleActionMenu,
  onViewDetails,
  onEditUser,
  onDeleteUser,
  onSendEmail,
  onResetPassword,
  onSort,
  onAddUser,
  onRefresh
}) => {
  if (loading && usersData.length === 0) {
    return (
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <div className="min-w-full divide-y divide-gray-200">
          <div className="bg-gray-50 flex">
            {columns.map((col, index) => (
              <div key={index} className="py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider flex-1">
                <Skeleton className="h-6 w-3/4" />
              </div>
            ))}
            <div className="py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
              <Skeleton className="h-6 w-full" />
            </div>
          </div>
          <div className="bg-white divide-y divide-gray-200">
            {Array(5).fill(0).map((_, rowIndex) => (
              <div key={rowIndex} className="flex">
                {columns.map((col, colIndex) => (
                  <div key={colIndex} className="py-4 px-4 flex-1">
                    <Skeleton className={`h-5 ${colIndex === 0 ? 'w-3/4' : 'w-1/2'}`} />
                  </div>
                ))}
                <div className="py-4 px-4 w-24">
                  <Skeleton className="h-5 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-red-50 border border-red-200 rounded-lg my-4">
        <AlertCircle size={24} className="text-red-500 mb-2" />
        <p className="text-red-700 mb-4">{error}</p>
        <button 
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          onClick={() => onRefresh()}
        >
          Retry
        </button>
      </div>
    );
  }
  
  if (usersData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-50 border border-gray-200 rounded-lg my-4">
        <User size={24} className="text-gray-400 mb-2" />
        <p className="text-gray-500 mb-4">No users found</p>
        <button 
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          onClick={onAddUser}
        >
          Add User
        </button>
      </div>
    );
  }
  
  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map(column => (
              <th 
                key={column.key}
                onClick={() => column.sortable && onSort(column.key)}
                className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''}`}
              >
                <div className="flex items-center">
                  <span>{column.label}</span>
                  {column.sortable && <ArrowUpDown size={14} className="ml-1" />}
                </div>
              </th>
            ))}
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider relative w-20">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {usersData.map(user => (
            <tr key={user.id} className="hover:bg-gray-50">
              {columns.map(column => {
                if (column.key === "name") {
                  return (
                    <td key={column.key} className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-medium mr-3">
                          {user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : '?'}
                        </div>
                        <span className="font-medium text-gray-900">{user.name}</span>
                      </div>
                    </td>
                  );
                } else if (column.key === "role") {
                  let roleName;
                  // Handle both scenarios: role as string or role as object
                  if (typeof user.role === 'string') {
                    roleName = user.role;
                  } else if (user.role?.name) {
                    roleName = user.role.name;
                  } else if (user.roleType) {
                    roleName = user.roleType;
                  } else {
                    roleName = 'User';
                  }
                  
                  return (
                    <td key={column.key} className="px-4 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {roleName}
                      </span>
                    </td>
                  );
                } else if (column.key === "status") {
                  return (
                    <td key={column.key} className="px-4 py-4 whitespace-nowrap">
                      <StatusBadge status={user.status || 'inactive'} statusConfig={statusConfig} />
                    </td>
                  );
                } else if (column.key === "lastLogin") {
                  return (
                    <td key={column.key} className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatTimeAgo(user[column.key])}
                    </td>
                  );
                } else if (column.key === "createdAt") {
                  return (
                    <td key={column.key} className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(user[column.key])}
                    </td>
                  );
                } else if (column.key === "department") {
                  return (
                    <td key={column.key} className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user[column.key] || "—"}
                    </td>
                  );
                } else {
                  return (
                    <td key={column.key} className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user[column.key]}
                    </td>
                  );
                }
              })}
              <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="relative">
                  <button
                    className="text-gray-400 hover:text-gray-500 focus:outline-none"
                    onClick={() => onToggleActionMenu(user.id)}
                    aria-haspopup="true"
                  >
                    <MoreVertical size={16} />
                  </button>
                  {actionMenuOpen === user.id && (
                    <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10 action-menu">
                      <div className="py-1">
                        {actions.view.enabled && (
                          <button 
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                            onClick={() => onViewDetails(user)}
                          >
                            <Eye size={14} className="mr-2" />
                            <span>{actions.view.label}</span>
                          </button>
                        )}
                        {actions.edit.enabled && (
                          <button 
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                            onClick={() => onEditUser(user)}
                          >
                            <Edit size={14} className="mr-2" />
                            <span>{actions.edit.label}</span>
                          </button>
                        )}
                        {actions.email.enabled && (
                          <button 
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                            onClick={() => onSendEmail(user.id)}
                          >
                            <Mail size={14} className="mr-2" />
                            <span>{actions.email.label}</span>
                          </button>
                        )}
                        {actions.resetPassword.enabled && (
                          <button 
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                            onClick={() => onResetPassword(user.id)}
                          >
                            <Lock size={14} className="mr-2" />
                            <span>{actions.resetPassword.label}</span>
                          </button>
                        )}
                        {actions.delete.enabled && (
                          <button 
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center"
                            onClick={() => onDeleteUser(user.id)}
                          >
                            <Trash2 size={14} className="mr-2" />
                            <span>{actions.delete.label}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// RolesTable Component
const RolesTable = ({ 
  rolesData, 
  loading, 
  error, 
  columns, 
  actions, 
  actionMenuOpen, 
  onToggleActionMenu,
  onViewDetails,
  onEditRole,
  onDeleteRole,
  onAssignUsers,
  onSort,
  onAddRole,
  onRefresh
}) => {
    // Helper function to get display-friendly permission names
const getDisplayPermissions = (permissions) => {
  if (!permissions) return [];
  
  const permArray = [];
  
  try {
    // Handle string format permissions (JSON)
    if (typeof permissions === 'string') {
      const parsedPermissions = JSON.parse(permissions);
      Object.keys(parsedPermissions).forEach(perm => {
        if (parsedPermissions[perm] === true) {
          permArray.push(perm);
        }
      });
    } 
    // Handle object format
    else if (typeof permissions === 'object') {
      Object.keys(permissions).forEach(perm => {
        if (permissions[perm] === true) {
          permArray.push(perm);
        }
      });
    }
  } catch (e) {
    console.error("Error parsing permissions:", e);
    return [];
  }
  
  return permArray;
};
  if (loading && rolesData.length === 0) {
    return (
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <div className="min-w-full divide-y divide-gray-200">
          <div className="bg-gray-50 flex">
            {columns.map((col, index) => (
              <div key={index} className="py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider flex-1">
                <Skeleton className="h-6 w-3/4" />
              </div>
            ))}
            <div className="py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
              <Skeleton className="h-6 w-full" />
            </div>
          </div>
          <div className="bg-white divide-y divide-gray-200">
            {Array(5).fill(0).map((_, rowIndex) => (
              <div key={rowIndex} className="flex">
                {columns.map((col, colIndex) => (
                  <div key={colIndex} className="py-4 px-4 flex-1">
                    <Skeleton className={`h-5 ${colIndex === 0 ? 'w-3/4' : 'w-1/2'}`} />
                  </div>
                ))}
                <div className="py-4 px-4 w-24">
                  <Skeleton className="h-5 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-red-50 border border-red-200 rounded-lg my-4">
        <AlertCircle size={24} className="text-red-500 mb-2" />
        <p className="text-red-700 mb-4">{error}</p>
        <button 
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          onClick={() => onRefresh()}
        >
          Retry
        </button>
      </div>
    );
  }
  
  if (rolesData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-50 border border-gray-200 rounded-lg my-4">
        <Shield size={24} className="text-gray-400 mb-2" />
        <p className="text-gray-500 mb-4">No roles found</p>
        <button 
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          onClick={onAddRole}
        >
          Add Role
        </button>
      </div>
    );
  }
  
  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map(column => (
              <th 
                key={column.key}
                onClick={() => column.sortable && onSort(column.key)}
                className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''} ${column.key === "permissions" ? 'w-1/3' : ''}`}
              >
                <div className="flex items-center">
                  <span>{column.label}</span>
                  {column.sortable && <ArrowUpDown size={14} className="ml-1" />}
                </div>
              </th>
            ))}
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider relative w-20">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {rolesData.map(role => (
            <tr key={role.id} className="hover:bg-gray-50">
              {columns.map(column => {
                if (column.key === "name") {
                  return (
                    <td key={column.key} className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                          {role.name}
                        </span>
                      </div>
                    </td>
                  );
                } else if (column.key === "permissions") {
                  // Safely handle permissions
                  const permissions = role.permissions || {};
                  let permissionCount = 0;
                  const displayedPermissions = getDisplayPermissions(role.permissions);
                
                  // Parse permissions - handle both object of objects and flat object structures
                  try {
                    if (typeof permissions === 'string') {
                      // If permissions is a JSON string, parse it
                      const parsedPermissions = JSON.parse(permissions);
                      
                      Object.entries(parsedPermissions).forEach(([category, perms]) => {
                        if (typeof perms === 'object') {
                          // Handle nested structure {category: {action: boolean}}
                          Object.entries(perms).forEach(([action, enabled]) => {
                            if (enabled && permissionCount < 4) {
                              displayedPermissions.push(`${action} ${category}`);
                            }
                            if (enabled) permissionCount++;
                          });
                        } else if (perms) {
                          // Handle flat structure {permission: boolean}
                          if (permissionCount < 4) {
                            displayedPermissions.push(category);
                          }
                          permissionCount++;
                        }
                      });
                    } else if (typeof permissions === 'object') {
                      // Direct object handling
                      Object.entries(permissions).forEach(([category, perms]) => {
                        if (typeof perms === 'object') {
                          // Handle nested structure {category: {action: boolean}}
                          Object.entries(perms).forEach(([action, enabled]) => {
                            if (enabled && permissionCount < 4) {
                              displayedPermissions.push(`${action} ${category}`);
                            }
                            if (enabled) permissionCount++;
                          });
                        } else if (perms) {
                          // Handle flat structure {permission: boolean}
                          if (permissionCount < 4) {
                            displayedPermissions.push(category);
                          }
                          permissionCount++;
                        }
                      });
                    }
                  } catch (e) {
                    console.error("Error parsing permissions:", e);
                    // In case of error, show a default message
                    return (
                      <td key={column.key} className="px-4 py-4">
                        <span className="text-sm text-gray-500">Permission data unavailable</span>
                      </td>
                    );
                  }
                  
                  return (
                    <td key={column.key} className="px-4 py-4">
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {displayedPermissions.map((perm, idx) => (
                          <span key={idx} className="px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                            {perm}
                          </span>
                        ))}
                        {permissionCount > 4 && (
                          <span className="px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600">
                            +{permissionCount - 4} more
                          </span>
                        )}
                      </div>
                    </td>
                  );
                } else {
                  return (
                    <td key={column.key} className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {role[column.key]}
                    </td>
                  );
                }
              })}
              <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="relative">
                  <button
                    className="text-gray-400 hover:text-gray-500 focus:outline-none"
                    onClick={() => onToggleActionMenu(role.id)}
                    aria-haspopup="true"
                  >
                    <MoreVertical size={16} />
                  </button>
                  {actionMenuOpen === role.id && (
                    <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10 action-menu">
                      <div className="py-1">
                        {actions.view.enabled && (
                          <button 
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                            onClick={() => onViewDetails(role)}
                          >
                            <Eye size={14} className="mr-2" />
                            <span>{actions.view.label}</span>
                          </button>
                        )}
                        {actions.edit.enabled && (
                          <button 
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                            onClick={() => onEditRole(role)}
                          >
                            <Edit size={14} className="mr-2" />
                            <span>{actions.edit.label}</span>
                          </button>
                        )}
                        {actions.assignUsers.enabled && (
                          <button 
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                            onClick={() => onAssignUsers(role.id)}
                          >
                            <Users size={14} className="mr-2" />
                            <span>{actions.assignUsers.label}</span>
                          </button>
                        )}
                        {actions.delete.enabled && (
                          <button 
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center"
                            onClick={() => onDeleteRole(role.id)}
                          >
                            <Trash2 size={14} className="mr-2" />
                            <span>{actions.delete.label}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Main Component
const UserRoleManagement = ({ 
  // Configuration props
  config = {},
  
  // Callback props
  onUserAdd,
  onUserEdit,
  onUserDelete,
  onRoleAdd,
  onRoleEdit,
  onRoleDelete,
  onExport,
  onRefresh,
  onFilterChange,
  onSearchChange
}) => {

const [pagePermissions, setPagePermissions] = useState({
  canViewUsers: false,
  canCreateUsers: false,
  canViewRoles: false,
  canCreateRoles: false,
  canExportUsers: false,
  canUpdateUsers:false,
  canUpdateRoles:false,
  canDeleteRoles:false,
  canDeleteUsers:false

});

useEffect(() => {
  const fetchPermissions = async () => {
    const canViewUsers = await getPermission("users.view");
    const canCreateUsers = await getPermission("users.create");
    const canViewRoles = await getPermission("roles.view");
    const canCreateRoles = await getPermission("roles.create");
    const canExportUsers = await getPermission("users.export");
    const canUpdateUsers = await getPermission("users.update");
    const canUpdateRoles = await getPermission("roles.update");
    const canDeleteRoles = await getPermission("roles.delete");
    const canDeleteUsers = await getPermission("users.delete");

    setPagePermissions({
      canViewUsers,
      canCreateUsers,
      canViewRoles,
      canCreateRoles,
      canExportUsers,
      canUpdateRoles,
      canUpdateUsers,
      canDeleteRoles,
      canDeleteUsers
    });
  };

  fetchPermissions();
}, []);


  // Default configurations
const defaultConfig = {
  // Page header configuration
  header: {
    title: "User & Role Management",
    description: "Manage users, assign roles, and control access permissions for your organization"
  },
  
  // Tab configuration
  tabs: {
    users: {
      label: "Users",
      icon: <Users size={18} />,
      enabled: pagePermissions.canViewUsers
    },
    roles: {
      label: "Roles & Permissions",
      icon: <Shield size={18} />,
      enabled: pagePermissions.canViewRoles
    }
  },
  
  // Filter options
  filters: {
    status: {
      enabled: true,
      options: ["all", "active", "inactive", "deleted", "pending"]
    },
    role: {
      enabled: true
    }
  },
  
  // Table configurations
  tables: {
    users: {
      columns: [
        { key: "name", label: "Name", sortable: true },
        { key: "email", label: "Email", sortable: true },
        { key: "role", label: "Role", sortable: true },
        { key: "department", label: "Department", sortable: true },
        { key: "status", label: "Status", sortable: true },
        { key: "lastLogin", label: "Last Login", sortable: true },
        { key: "createdAt", label: "Created", sortable: true }
      ]
    },
    roles: {
      columns: [
        { key: "name", label: "Role Name", sortable: true },
        { key: "description", label: "Description", sortable: true },
        { key: "users", label: "Users", sortable: true },
        { key: "permissions", label: "Key Permissions", sortable: false }
      ]
    }
  },
  
  // Actions configuration
  actions: {
    addUser: {
      enabled: pagePermissions.canCreateUsers,
      label: "Add User"
    },
    addRole: {
      enabled: pagePermissions.canCreateRoles,
      label: "Add Role"
    },
    export: {
      enabled: pagePermissions.canExportUsers,
      label: "Export"
    },
    refresh: {
      enabled: true,
      label: "Refresh"
    },
    userActions: {
      view: { enabled:pagePermissions.canViewUsers, label: "View Details" },
      edit: { enabled: pagePermissions.canUpdateUsers, label: "Edit User" },
      email: { enabled: pagePermissions.canUpdateUsers, label: "Send Email" },
      resetPassword: { enabled: pagePermissions.canUpdateUsers, label: "Reset Password" },
      delete: { enabled: pagePermissions.canDeleteUsers, label: "Delete User" }
    },
    roleActions: {
      view: { enabled: pagePermissions.canViewRoles, label: "View Details" },
      edit: { enabled: pagePermissions.canUpdateRoles, label: "Edit Role" },
      assignUsers: { enabled: pagePermissions.canUpdateRoles, label: "Assign Users" },
      delete: { enabled: pagePermissions.canDeleteRoles, label: "Delete Role" }
    }
  },
  
  // Status configuration
  statusConfig: {
    active: {
      color: "bg-emerald-100 text-emerald-800",
      icon: <CheckCircle size={14} className="mr-1" />
    },
    inactive: {
      color: "bg-gray-100 text-gray-800",
      icon: <XCircle size={14} className="mr-1" />
    },
    deleted: {
      color: "bg-red-100 text-red-800",
      icon: <XCircle size={14} className="mr-1" />
    },
    pending: {
      color: "bg-amber-100 text-amber-800",
      icon: <AlertCircle size={14} className="mr-1" />
    },
    default: {
      color: "bg-gray-100 text-gray-800",
      icon: <AlertCircle size={14} className="mr-1" />
    }
  },
  
  // Modal configurations
  modals: {
    viewUser: {
      enabled: pagePermissions.canViewUsers,
      title: "User Details"
    },
    viewRole: {
      enabled:pagePermissions.canViewRoles,
      title: "Role Details"
    },
    addUser: {
      enabled: pagePermissions.canCreateUsers,
      title: "Add New User",
      fields: [
        { key: "firstName", label: "First Name", type: "text", required: true },
        { key: "lastName", label: "Last Name", type: "text", required: true },
        { key: "email", label: "Email Address", type: "email", required: true, fullWidth: true },
        { key: "role", label: "Role", type: "select", options: "roles", required: true },
        { key: "department", label: "Department", type: "text" },
        { key: "status", label: "Status", type: "select", options: ["active", "inactive", "deleted", "pending"], defaultValue: "active" },
        { key: "sendEmail", label: "Send Welcome Email", type: "toggle", defaultValue: true }
      ]
    },
    addRole: {
      enabled: pagePermissions.canCreateRoles,
      title: "Add New Role",
      fields: [
        { key: "name", label: "Role Name", type: "text", required: true, fullWidth: true },
        { key: "description", label: "Description", type: "textarea", required: true, fullWidth: true }
      ],
      permissionCategories: [
        { 
          key: "users", 
          title: "User Management",
          permissions: ["view", "create", "edit", "delete"]
        },
        { 
          key: "invoices", 
          title: "Invoices",
          permissions: ["view", "create", "edit", "delete"]
        },
        { 
          key: "reports", 
          title: "Reports",
          permissions: ["view", "create", "export"]
        },
        { 
          key: "settings", 
          title: "Settings",
          permissions: ["view", "edit"]
        }
      ]
    }
  },
  
  // Callbacks
  callbacks: {
    onUserAdd: null,
    onUserEdit: null,
    onUserDelete: null,
    onRoleAdd: null,
    onRoleEdit: null,
    onRoleDelete: null,
    onExport: null,
    onRefresh: null,
    onFilterChange: null,
    onSearchChange: null,
    onSort: null
  },
  
  // Pagination
  pagination: {
    enabled: true,
    itemsPerPage: 10,
    showTotalItems: true
  }
};

  
  // Merge the provided config with the default config
  const mergedConfig = {
    ...defaultConfig,
    ...config,
    header: { ...defaultConfig.header, ...config.header },
    tabs: { ...defaultConfig.tabs, ...config.tabs },
    filters: { ...defaultConfig.filters, ...config.filters },
    tables: { 
      users: { ...defaultConfig.tables.users, ...config?.tables?.users },
      roles: { ...defaultConfig.tables.roles, ...config?.tables?.roles }
    },
    actions: { 
      ...defaultConfig.actions, 
      ...config.actions,
      userActions: { ...defaultConfig.actions.userActions, ...config?.actions?.userActions },
      roleActions: { ...defaultConfig.actions.roleActions, ...config?.actions?.roleActions }
    },
    statusConfig: { ...defaultConfig.statusConfig, ...config.statusConfig },
    modals: { 
      ...defaultConfig.modals, 
      ...config.modals,
      addUser: { ...defaultConfig.modals.addUser, ...config?.modals?.addUser },
      addRole: { ...defaultConfig.modals.addRole, ...config?.modals?.addRole }
    },
    callbacks: { ...defaultConfig.callbacks, ...config.callbacks },
    pagination: { ...defaultConfig.pagination, ...config.pagination }
  };

  // State
  const [showAssignUsersModal, setShowAssignUsersModal] = useState(false);
  const [selectedRoleForUsers, setSelectedRoleForUsers] = useState(null);
  const [activeTab, setActiveTab] = useState("users");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterRole, setFilterRole] = useState("all");
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [showUserDetailsModal, setShowUserDetailsModal] = useState(false);
  const [showRoleDetailsModal, setShowRoleDetailsModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showEditRoleModal, setShowEditRoleModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [sortConfig, setSortConfig] = useState({
    key: "name",
    direction: "ascending"
  });
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [toast, setToast] = useState(null);

  // Data state
  const [usersData, setUsersData] = useState([]);
  const [rolesData, setRolesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  // Form data state
  const [userFormData, setUserFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "",
    department: "",
    status: "active",
    sendEmail: true
  });
  
  const [roleFormData, setRoleFormData] = useState({
    name: "",
    description: "",
    permissions: {}
  });
  const handleAssignUsers = async (roleId) => {
    try {
      // Find the selected role
      const role = rolesData.find(r => r.id === roleId);
      
      if (!role) {
        throw new Error("Role not found");
      }
      
      // Set the selected role and show the modal
      setSelectedRoleForUsers({
        id: role.id,
        name: role.name
      });
      
      setShowAssignUsersModal(true);
      setIsActionMenuOpen(null); // Close the action menu
    } catch (err) {
      console.error("Error preparing to assign users:", err);
      setToast({
        message: err.message || "Failed to prepare user assignment.",
        type: "error"
      });
    }
  };
  
  // Add a handler for when users are successfully assigned
  const handleUsersAssigned = () => {
    // Show success message
    setToast({
      message: "Users assigned to role successfully",
      type: "success"
    });
    
    // Refresh roles data to update user counts
    fetchRoles();
  };
  // Form validation state
  const [formErrors, setFormErrors] = useState({});
  
  // Refs
  const actionMenuRef = useRef(null);
  
// Initialize permissions for role form
useEffect(() => {
  const initializePermissions = () => {
    const permissions = {};
    
    // Initialize all permissions as false
    Object.entries(permissionModules).forEach(([module, { actions }]) => {
      actions.forEach(action => {
        permissions[`${module}.${action}`] = false;
      });
    });
    
    setRoleFormData(prev => ({
      ...prev,
      permissions
    }));
  };
  
  initializePermissions();
}, []);
  
  // Load users and roles on component mount
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        // Fetch roles first (needed for user form)
        await fetchRoles();
        
        // Then fetch users
        await fetchUsers();
      } catch (err) {
        setError("Failed to load data. Please try again.");
        console.error("Error loading initial data:", err);
      } finally {
        setLoading(false);
      }
    };
    
    loadInitialData();
  }, []);
  
  // Fetch users with current filters and pagination
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        page: currentPage,
        limit: mergedConfig.pagination.itemsPerPage,
        sortBy: sortConfig.key,
        sortOrder: sortConfig.direction === 'ascending' ? 'asc' : 'desc',
        status: filterStatus !== 'all' ? filterStatus : undefined,
        role: filterRole !== 'all' ? filterRole : undefined,
        search: searchTerm || undefined
      };
      
      const response = await api.fetchUsers(params);
      
      if (response.users && Array.isArray(response.users)) {
        setUsersData(response.users);
        setTotalUsers(response.pagination?.totalCount || response.users.length);
        setTotalPages(response.pagination?.totalPages || 1);
      } else {
        console.warn("Unexpected API response format:", response);
        setUsersData([]);
        setTotalUsers(0);
        setTotalPages(1);
      }
      
      return response.users || [];
    } catch (err) {
      console.error("Error fetching users:", err);
      setError("Failed to fetch users. Please try again.");
      setUsersData([]);
      setTotalUsers(0);
      setTotalPages(1);
      return [];
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch roles with current search and sorting
  const fetchRoles = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        sortBy: sortConfig.key !== 'permissions' ? sortConfig.key : 'name', // Fall back to name if sorting by permissions
        sortOrder: sortConfig.direction === 'ascending' ? 'asc' : 'desc',
        search: searchTerm || undefined
      };
      
      // Get the response from the API
      const response = await api.fetchRoles(params);
      
      // Determine what format the data is in and extract the roles array
      let rolesArray = [];
      
      if (Array.isArray(response)) {
        // If the response is already an array, use it directly
        rolesArray = response;
      } else if (response && typeof response === 'object') {
        // If the response is an object, try to extract the roles array
        if (Array.isArray(response.roles)) {
          rolesArray = response.roles;
        } else if (Array.isArray(response.rolesData)) {
          rolesArray = response.rolesData;
        } else if (response.id) {
          // Single role object
          rolesArray = [response];
        } else {
          // If we can't find a roles array, log the issue and use an empty array
          console.warn("Unexpected roles API response format:", response);
          rolesArray = [];
        }
      }
      
      // Process permissions and count users for each role
      const processedRoles = rolesArray.map(role => {
        // Use placeholder for user count if not available
        const usersCount = typeof role.users === 'number' ? role.users : 
                         Array.isArray(role.users) ? role.users.length : 0;
        
        return {
          ...role,
          // Ensure permissions is always an object
          permissions: role.permissions || {},
          // Set users count
          users: usersCount
        };
      });
      
      // Always set an array (even if empty) to prevent map errors
      setRolesData(processedRoles);
      
      return processedRoles;
    } catch (err) {
      console.error("Error fetching roles:", err);
      setError("Failed to fetch roles. Please try again.");
      setRolesData([]); // Set to empty array on error
      return [];
    } finally {
      setLoading(false);
    }
  };
  
  // Handle clicks outside action menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if action menu is open and click is outside
      if (isActionMenuOpen && !event.target.closest('.action-menu') && 
          !event.target.closest('button[aria-haspopup="true"]')) {
        setIsActionMenuOpen(null);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isActionMenuOpen]);
  
  // Reset pagination when changing tabs or filters
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, filterStatus, filterRole, searchTerm]);
  
  // Refresh data when tab changes
  useEffect(() => {
    if (activeTab === "users") {
      fetchUsers();
    } else {
      fetchRoles();
    }
  }, [activeTab]);
  
  // Handle sort
  const handleSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
    
    if (mergedConfig.callbacks.onSort) {
      mergedConfig.callbacks.onSort(key, direction);
    }
    
    // Refetch data with new sort
    if (activeTab === "users") {
      fetchUsers();
    } else {
      fetchRoles();
    }
  };
  
  // Handle action menu toggle
  const toggleActionMenu = (id) => {
    setIsActionMenuOpen(isActionMenuOpen === id ? null : id);
  };
  
  // View user details
  const viewUserDetails = async (user) => {
    try {
      setLoading(true);
      const userData = await api.fetchUserById(user.id);
      
      // Process user data for display
      const processedUser = {
        ...userData,
        // Ensure role is properly formatted (might be string, object, or roleId)
        role: typeof userData.role === 'string' ? userData.role : 
             userData.role?.name || userData.roleType || 'User'
      };
      
      setSelectedUser(processedUser);
      setShowUserDetailsModal(true);
    } catch (err) {
      console.error("Error fetching user details:", err);
      setToast({
        message: "Failed to fetch user details. Please try again.",
        type: "error"
      });
    } finally {
      setLoading(false);
      setIsActionMenuOpen(null);
    }
  };
  
  // View role details
  const viewRoleDetails = async (role) => {
    try {
      setLoading(true);
      let roleData;
      
      try {
        // Try to fetch detailed role data
        roleData = await api.fetchRoleById(role.id);
      } catch (e) {
        // If fetch fails, use the existing role data
        console.warn("Error fetching role details, using provided data:", e);
        roleData = role;
      }
      
      // Ensure permissions are properly structured
      let processedPermissions = roleData.permissions;
      
      // Parse JSON string if needed
      if (typeof processedPermissions === 'string') {
        try {
          processedPermissions = JSON.parse(processedPermissions);
        } catch (e) {
          console.error("Error parsing permissions JSON:", e);
          processedPermissions = {}; // Default to empty object on error
        }
      }
      
      // Process users data if available
      const assignedUsers = Array.isArray(roleData.users) ? roleData.users : [];
      
      const processedRole = {
        ...roleData,
        permissions: processedPermissions || {},
        assignedUsers: assignedUsers,
        // Ensure users count is available
        users: typeof roleData.users === 'number' ? roleData.users : assignedUsers.length
      };
      
      setSelectedRole(processedRole);
      setShowRoleDetailsModal(true);
    } catch (err) {
      console.error("Error processing role details:", err);
      setToast({
        message: "Failed to display role details. Please try again.",
        type: "error"
      });
    } finally {
      setLoading(false);
      setIsActionMenuOpen(null);
    }
  };
  
  // Handle search change with debounce
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    // Debounce API calls for search
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => {
      if (mergedConfig.callbacks.onSearchChange) {
        mergedConfig.callbacks.onSearchChange(value);
      }
      
      if (onSearchChange) {
        onSearchChange(value);
      }
      
      // Refetch data with search term
      if (activeTab === "users") {
        fetchUsers();
      } else {
        fetchRoles();
      }
    }, 300);
  };
  
  // Handle filter change
  const handleFilterChange = (type, value) => {
    if (type === "status") {
      setFilterStatus(value);
    } else if (type === "role") {
      setFilterRole(value);
    }
    
    if (mergedConfig.callbacks.onFilterChange) {
      mergedConfig.callbacks.onFilterChange(type, value);
    }
    
    if (onFilterChange) {
      onFilterChange(type, value);
    }
    
    // Refetch users with new filters
    fetchUsers();
  };
  
  // Handle refresh
  const handleRefresh = () => {
    if (activeTab === "users") {
      fetchUsers();
    } else {
      fetchRoles();
    }
    
    if (mergedConfig.callbacks.onRefresh) {
      mergedConfig.callbacks.onRefresh();
    }
    
    if (onRefresh) {
      onRefresh();
    }
  };
  
  // Handle export
  const handleExport = async () => {
    try {
      setLoading(true);
      
      if (activeTab === "users") {
        const filters = {
          status: filterStatus !== 'all' ? filterStatus : undefined,
          role: filterRole !== 'all' ? filterRole : undefined,
          search: searchTerm || undefined
        };
        
        const blob = await api.exportUsers(filters);
        
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'users.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        
        setToast({
          message: "Users exported successfully",
          type: "success"
        });
      } else {
        const blob = await api.exportRoles();
        
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'roles.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        
        setToast({
          message: "Roles exported successfully",
          type: "success"
        });
      }
      
      if (mergedConfig.callbacks.onExport) {
        mergedConfig.callbacks.onExport(activeTab);
      }
      
      if (onExport) {
        onExport(activeTab);
      }
    } catch (err) {
      console.error("Error exporting data:", err);
      setToast({
        message: "Failed to export data. Please try again.",
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Handle user form input change
  const handleUserFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setUserFormData({
      ...userFormData,
      [name]: type === "checkbox" ? checked : value
    });
    
    // Clear validation error for this field if it exists
    if (formErrors[name]) {
      setFormErrors({
        ...formErrors,
        [name]: null
      });
    }
  };
  
// Handle role form input change
const handleRoleFormChange = (e) => {
  const { name, value, type, checked } = e.target;
  
  if (name.startsWith('permission.')) {
    // Handle permission checkbox with module.action format
    const permission = name.substring(11); // Remove 'permission.' prefix
    
    setRoleFormData({
      ...roleFormData,
      permissions: {
        ...roleFormData.permissions,
        [permission]: checked
      }
    });
  } else {
    // Handle regular input
    setRoleFormData({
      ...roleFormData,
      [name]: value
    });
    
    // Clear validation error for this field if it exists
    if (formErrors[name]) {
      setFormErrors({
        ...formErrors,
        [name]: null
      });
    }
  }
};

// Toggle all permissions for a module
const toggleModulePermissions = (module) => {
  const moduleActions = permissionModules[module].actions;
  
  // Check if all actions are currently enabled
  const allEnabled = moduleActions.every(action => 
    roleFormData.permissions[`${module}.${action}`] === true
  );
  
  // Create updated permissions object
  const updatedPermissions = { ...roleFormData.permissions };
  
  // Toggle all actions for this module
  moduleActions.forEach(action => {
    updatedPermissions[`${module}.${action}`] = !allEnabled;
  });
  
  setRoleFormData({
    ...roleFormData,
    permissions: updatedPermissions
  });
};
  
  // Toggle all permissions for a category
  const toggleAllPermissions = (category, checked) => {
    const categoryPermissions = { ...roleFormData.permissions[category] };
    
    // Update all permissions in the category
    Object.keys(categoryPermissions).forEach(action => {
      categoryPermissions[action] = checked;
    });
    
    setRoleFormData({
      ...roleFormData,
      permissions: {
        ...roleFormData.permissions,
        [category]: categoryPermissions
      }
    });
  };
  
  // Validate user form
  const validateUserForm = () => {
    const errors = {};
    
    if (!userFormData.firstName) {
      errors.firstName = "First name is required";
    }
    
    if (!userFormData.lastName) {
      errors.lastName = "Last name is required";
    }
    
    if (!userFormData.email) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userFormData.email)) {
      errors.email = "Invalid email format";
    }
    
    if (!userFormData.role) {
      errors.role = "Role is required";
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // Validate role form
  const validateRoleForm = () => {
    const errors = {};
    
    if (!roleFormData.name) {
      errors.name = "Role name is required";
    }
    
    if (!roleFormData.description) {
      errors.description = "Description is required";
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // Handle add user
  const handleAddUser = async (e) => {
    e.preventDefault();
    
    if (!validateUserForm()) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Prepare user data - look for either role ID or role name
      const selectedRole = rolesData.find(r => r.id === userFormData.role || r.name === userFormData.role);
      
      // Prepare user data to match API expectations
      const userData = {
        name: `${userFormData.firstName} ${userFormData.lastName}`,
        email: userFormData.email,
        role: selectedRole?.id || userFormData.role, // Prefer ID if available
        department: userFormData.department || null,
        status: userFormData.status,
        sendEmail: userFormData.sendEmail
      };
      
      // Create user
      const response = await api.createUser(userData);
      
      // Show success message
      setToast({
        message: "User created successfully",
        type: "success"
      });
      
      // Close modal and reset form
      setShowAddUserModal(false);
      setUserFormData({
        firstName: "",
        lastName: "",
        email: "",
        role: "",
        department: "",
        status: "active",
        sendEmail: true
      });
      
      // Refresh users
      fetchUsers();
      
      if (mergedConfig.callbacks.onUserAdd) {
        mergedConfig.callbacks.onUserAdd(response.user);
      }
      
      if (onUserAdd) {
        onUserAdd(response.user);
      }
    } catch (err) {
      console.error("Error creating user:", err);
      setToast({
        message: err.message || "Failed to create user. Please try again.",
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Handle add role
  const handleAddRole = async (e) => {
    e.preventDefault();
    
    if (!validateRoleForm()) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Create role
      const response = await api.createRole(roleFormData);
      
      // Show success message
      setToast({
        message: "Role created successfully",
        type: "success"
      });
      
      // Close modal and reset form
      setShowAddRoleModal(false);
      
      // Reset form but preserve permissions structure
      const resetPermissions = {};
      Object.keys(roleFormData.permissions).forEach(category => {
        resetPermissions[category] = {};
        Object.keys(roleFormData.permissions[category]).forEach(action => {
          resetPermissions[category][action] = false;
        });
      });
      
      setRoleFormData({
        name: "",
        description: "",
        permissions: resetPermissions
      });
      
      // Refresh roles
      fetchRoles();
      
      if (mergedConfig.callbacks.onRoleAdd) {
        mergedConfig.callbacks.onRoleAdd(response.role || response);
      }
      
      if (onRoleAdd) {
        onRoleAdd(response.role || response);
      }
    } catch (err) {
      console.error("Error creating role:", err);
      setToast({
        message: err.message || "Failed to create role. Please try again.",
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Handle edit user
  const handleEditUser = async (userData) => {
    try {
      // Parse user data for editing
      const [firstName, ...lastNameParts] = (userData.name || '').split(' ');
      const lastName = lastNameParts.join(' ') || '';
      
      // Set editing user data
      setEditingUser({
        id: userData.id,
        firstName: firstName || '',
        lastName: lastName || '',
        email: userData.email || '',
        role: userData.role?.id || userData.role || '',
        department: userData.department || '',
        status: userData.status || 'active'
      });
      
      // Show edit modal
      setShowEditUserModal(true);
      setIsActionMenuOpen(null); // Close action menu
      
      if (mergedConfig.callbacks.onUserEdit) {
        mergedConfig.callbacks.onUserEdit(userData);
      }
      
      if (onUserEdit) {
        onUserEdit(userData);
      }
    } catch (err) {
      console.error("Error preparing user edit:", err);
      setToast({
        message: "Failed to prepare user edit. Please try again.",
        type: "error"
      });
    }
  };

  // Handle update user
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    
    // Validate editing user data
    const errors = {};
    
    if (!editingUser.firstName) {
      errors.firstName = "First name is required";
    }
    
    if (!editingUser.lastName) {
      errors.lastName = "Last name is required";
    }
    
    if (!editingUser.email) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editingUser.email)) {
      errors.email = "Invalid email format";
    }
    
    if (!editingUser.role) {
      errors.role = "Role is required";
    }
    
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Prepare user data - look for either role ID or role name
      const selectedRole = rolesData.find(r => r.id === editingUser.role || r.name === editingUser.role);
      
      // Prepare user data to match API expectations
      const userData = {
        name: `${editingUser.firstName} ${editingUser.lastName}`,
        email: editingUser.email,
        role: selectedRole?.id || editingUser.role, // Prefer ID if available
        department: editingUser.department || null,
        status: editingUser.status
      };
      
      // Update user
      const response = await api.updateUser(editingUser.id, userData);
      
      // Show success message
      setToast({
        message: "User updated successfully",
        type: "success"
      });
      
      // Close modal and reset form
      setShowEditUserModal(false);
      setEditingUser(null);
      
      // Refresh users
      fetchUsers();
      
      if (mergedConfig.callbacks.onUserEdit) {
        mergedConfig.callbacks.onUserEdit(response.user || response);
      }
      
      if (onUserEdit) {
        onUserEdit(response.user || response);
      }
    } catch (err) {
      console.error("Error updating user:", err);
      setToast({
        message: err.message || "Failed to update user. Please try again.",
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Handle edit role
  const handleEditRole = async (roleData) => {
    try {
      // Set editing role data
      setEditingRole({
        id: roleData.id,
        name: roleData.name || '',
        description: roleData.description || '',
        permissions: roleData.permissions || {}
      });
      
      // Show edit modal
      setShowEditRoleModal(true);
      setIsActionMenuOpen(null); // Close action menu
      
      if (mergedConfig.callbacks.onRoleEdit) {
        mergedConfig.callbacks.onRoleEdit(roleData);
      }
      
      if (onRoleEdit) {
        onRoleEdit(roleData);
      }
    } catch (err) {
      console.error("Error preparing role edit:", err);
      setToast({
        message: "Failed to prepare role edit. Please try again.",
        type: "error"
      });
    }
  };

  // Handle update role
  const handleUpdateRole = async (e) => {
    e.preventDefault();
    
    // Validate editing role data
    const errors = {};
    
    if (!editingRole.name) {
      errors.name = "Role name is required";
    }
    
    if (!editingRole.description) {
      errors.description = "Description is required";
    }
    
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Update role
      const response = await api.updateRole(editingRole.id, editingRole);
      
      // Show success message
      setToast({
        message: "Role updated successfully",
        type: "success"
      });
      
      // Close modal and reset form
      setShowEditRoleModal(false);
      setEditingRole(null);
      
      // Refresh roles
      fetchRoles();
      
      if (mergedConfig.callbacks.onRoleEdit) {
        mergedConfig.callbacks.onRoleEdit(response.role || response);
      }
      
      if (onRoleEdit) {
        onRoleEdit(response.role || response);
      }
    } catch (err) {
      console.error("Error updating role:", err);
      setToast({
        message: err.message || "Failed to update role. Please try again.",
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Handle delete user
  const handleDeleteUser = async (userId) => {
    if (!confirm("Are you sure you want to delete this user? The user will be deactivated but all their records will be preserved.")) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Delete user
      await api.deleteUser(userId);
      
      // Show success message
      setToast({
        message: "User deleted successfully",
        type: "success"
      });
      
      // Refresh users
      fetchUsers();
      
      if (mergedConfig.callbacks.onUserDelete) {
        mergedConfig.callbacks.onUserDelete(userId);
      }
      
      if (onUserDelete) {
        onUserDelete(userId);
      }
    } catch (err) {
      console.error("Error deleting user:", err);
      setToast({
        message: err.message || "Failed to delete user. Please try again.",
        type: "error"
      });
    } finally {
      setLoading(false);
      setIsActionMenuOpen(null);
    }
  };
  
  // Handle delete role
  const handleDeleteRole = async (roleId) => {
    if (!confirm("Are you sure you want to delete this role? This action cannot be undone.")) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Delete role
      await api.deleteRole(roleId);
      
      // Show success message
      setToast({
        message: "Role deleted successfully",
        type: "success"
      });
      
      // Refresh roles
      fetchRoles();
      
      if (mergedConfig.callbacks.onRoleDelete) {
        mergedConfig.callbacks.onRoleDelete(roleId);
      }
      
      if (onRoleDelete) {
        onRoleDelete(roleId);
      }
    } catch (err) {
      console.error("Error deleting role:", err);
      setToast({
        message: err.message || "Failed to delete role. Please try again.",
        type: "error"
      });
    } finally {
      setLoading(false);
      setIsActionMenuOpen(null);
    }
  };
  
  // Handle reset password
  const handleResetPassword = async (userId) => {
    try {
      setLoading(true);
      
      // Send password reset email
      await api.sendPasswordResetEmail(userId);
      
      // Show success message
      setToast({
        message: "Password reset email sent successfully",
        type: "success"
      });
    } catch (err) {
      console.error("Error sending password reset:", err);
      setToast({
        message: "Failed to send password reset. Please try again.",
        type: "error"
      });
    } finally {
      setLoading(false);
      setIsActionMenuOpen(null);
    }
  };
  
  // Handle sending email
  const handleSendEmail = async (userId) => {
    try {
      setLoading(true);
      
      // For now, send a default email (in a real app, you'd show an email form modal)
      const emailData = {
        subject: "Message from Admin",
        message: "This is a system message from the administrator.",
        emailType: "admin_message"
      };
      
      await api.sendEmailToUser(userId, emailData);
      
      // Show success message
      setToast({
        message: "Email sent successfully",
        type: "success"
      });
    } catch (err) {
      console.error("Error sending email:", err);
      setToast({
        message: err.message || "Failed to send email. Please try again.",
        type: "error"
      });
    } finally {
      setLoading(false);
      setIsActionMenuOpen(null);
    }
  };
  

  
  // Handle pagination
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    
    // Refetch data with new page
    if (activeTab === "users") {
      fetchUsers();
    }
  };
  
  return (
    <PermissionGuard permission="users.view">
    <div className="w-full max-w-full bg-white p-4">
      {/* Header Section */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{mergedConfig.header.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{mergedConfig.header.description}</p>
        </div>
        <div>
          {activeTab === "users" && mergedConfig.actions.addUser.enabled && (
            <button 
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              onClick={() => setShowAddUserModal(true)}
            >
              <Plus size={16} className="mr-2" />
              <span>{mergedConfig.actions.addUser.label}</span>
            </button>
          )}
          {activeTab === "roles" && mergedConfig.actions.addRole.enabled && (
            <button 
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              onClick={() => setShowAddRoleModal(true)}
            >
              <Plus size={16} className="mr-2" />
              <span>{mergedConfig.actions.addRole.label}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex space-x-8">
          {mergedConfig.tabs.users.enabled && (
            <button 
              className={`py-4 px-1 flex items-center space-x-2 border-b-2 font-medium text-sm ${
                activeTab === "users"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
              onClick={() => setActiveTab("users")}
            >
              {mergedConfig.tabs.users.icon}
              <span>{mergedConfig.tabs.users.label}</span>
              {loading && activeTab !== "users" ? (
                <span className="ml-2 px-2.5 py-0.5 text-xs rounded-full bg-gray-100">
                  <Skeleton className="w-6 h-5" />
                </span>
              ) : (
                <span className="ml-2 px-2.5 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                  {totalUsers}
                </span>
              )}
            </button>
          )}
          {mergedConfig.tabs.roles.enabled && (
            <button 
              className={`py-4 px-1 flex items-center space-x-2 border-b-2 font-medium text-sm ${
                activeTab === "roles"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
              onClick={() => setActiveTab("roles")}
            >
              {mergedConfig.tabs.roles.icon}
              <span>{mergedConfig.tabs.roles.label}</span>
              {loading && activeTab !== "roles" ? (
                <span className="ml-2 px-2.5 py-0.5 text-xs rounded-full bg-gray-100">
                  <Skeleton className="w-6 h-5" />
                </span>
              ) : (
                <span className="ml-2 px-2.5 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                  {rolesData.length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Users Tab Content */}
      {activeTab === "users" && mergedConfig.tabs.users.enabled && (
        <>
          {/* Controls */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-grow">
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
            
            <div className="flex flex-wrap gap-3">
              {mergedConfig.filters.status.enabled && (
                <div className="flex items-center space-x-2">
                  <div className="flex items-center text-sm text-gray-600">
                    <Filter size={16} className="mr-1" />
                    <span>Status:</span>
                  </div>
                  <div className="flex space-x-1">
                    {mergedConfig.filters.status.options.map(status => (
                      <button 
                        key={status}
                        className={`px-2.5 py-1.5 text-sm rounded-md ${
                          filterStatus === status
                            ? "bg-blue-100 text-blue-800 font-medium"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                        onClick={() => handleFilterChange("status", status)}
                      >
                        {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {mergedConfig.filters.role.enabled && rolesData.length > 0 && (
                <div className="flex items-center space-x-2">
                  <div className="flex items-center text-sm text-gray-600">
                    <Shield size={16} className="mr-1" />
                    <span>Role:</span>
                  </div>
                  <div className="relative">
                    <select
                      className="pl-3 pr-8 py-1.5 text-sm bg-gray-100 border-gray-200 rounded-md appearance-none focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      value={filterRole}
                      onChange={(e) => handleFilterChange("role", e.target.value)}
                    >
                      <option value="all">All Roles</option>
                      {rolesData.map(role => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                      <ChevronDown size={14} className="text-gray-400" />
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex space-x-2 ml-auto">
              {mergedConfig.actions.export.enabled && (
                <button 
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  onClick={handleExport}
                  disabled={loading}
                >
                  <Download size={16} className="mr-2" />
                  <span>{mergedConfig.actions.export.label}</span>
                </button>
              )}
              {mergedConfig.actions.refresh.enabled && (
                <button 
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  onClick={handleRefresh}
                  disabled={loading}
                >
                  {loading ? 
                    <Loader size={16} className="animate-spin mr-2" /> : 
                    <RefreshCw size={16} className="mr-2" />
                  }
                  <span>{mergedConfig.actions.refresh.label}</span>
                </button>
              )}
            </div>
          </div>

          {/* Users Table */}
          <UsersTable 
            usersData={usersData}
            loading={loading}
            error={error}
            columns={mergedConfig.tables.users.columns}
            statusConfig={mergedConfig.statusConfig}
            actions={mergedConfig.actions.userActions}
            actionMenuOpen={isActionMenuOpen}
            onToggleActionMenu={toggleActionMenu}
            onViewDetails={viewUserDetails}
            onEditUser={handleEditUser}
            onDeleteUser={handleDeleteUser}
            onSendEmail={handleSendEmail}
            onResetPassword={handleResetPassword}
            onSort={handleSort}
            onAddUser={() => setShowAddUserModal(true)}
            onRefresh={handleRefresh}
          />

          {/* Pagination */}
          {mergedConfig.pagination.enabled && usersData.length > 0 && (
            <div className="flex items-center justify-between mt-6">
              <button 
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={currentPage === 1 || loading}
                onClick={() => handlePageChange(currentPage - 1)}
              >
                Previous
              </button>
              <div className="text-sm text-gray-700">
                {loading ? (
                  <Skeleton className="w-40 h-6" />
                ) : (
                  <>
                    Page {currentPage} of {totalPages} 
                    {mergedConfig.pagination.showTotalItems && (
                      <span className="text-gray-500"> (Showing {usersData.length} of {totalUsers} users)</span>
                    )}
                  </>
                )}
              </div>
              <button 
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={currentPage === totalPages || loading}
                onClick={() => handlePageChange(currentPage + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Roles Tab Content */}
      {activeTab === "roles" && mergedConfig.tabs.roles.enabled && (
        <>
          {/* Controls */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search roles..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                value={searchTerm}
                onChange={handleSearchChange}
              />
            </div>
            
            <div className="flex space-x-2 ml-auto">
              {mergedConfig.actions.export.enabled && (
                <button 
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  onClick={handleExport}
                  disabled={loading}
                >
                  <Download size={16} className="mr-2" />
                  <span>{mergedConfig.actions.export.label}</span>
                </button>
              )}
              {mergedConfig.actions.refresh.enabled && (
                <button 
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  onClick={handleRefresh}
                  disabled={loading}
                >
                  {loading ? 
                    <Loader size={16} className="animate-spin mr-2" /> : 
                    <RefreshCw size={16} className="mr-2" />
                  }
                  <span>{mergedConfig.actions.refresh.label}</span>
                </button>
              )}
            </div>
          </div>

          {/* Roles Table */}
          <RolesTable 
            rolesData={rolesData}
            loading={loading}
            error={error}
            columns={mergedConfig.tables.roles.columns}
            actions={mergedConfig.actions.roleActions}
            actionMenuOpen={isActionMenuOpen}
            onToggleActionMenu={toggleActionMenu}
            onViewDetails={viewRoleDetails}
            onEditRole={handleEditRole}
            onDeleteRole={handleDeleteRole}
            onAssignUsers={handleAssignUsers}
            onSort={handleSort}
            onAddRole={() => setShowAddRoleModal(true)}
            onRefresh={handleRefresh}
          />
        </>
      )}

{/* Add User Modal */}
{showAddUserModal && mergedConfig.modals.addUser.enabled && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">{mergedConfig.modals.addUser.title}</h2>
          <button
            onClick={() => setShowAddUserModal(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>
      </div>
      
      <form onSubmit={handleAddUser}>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-1">
              <label htmlFor="firstName" className="block text-sm font-medium mb-1">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                className={`w-full p-2 border ${
                  formErrors.firstName 
                    ? 'border-red-300 text-red-900 placeholder-red-300 focus:outline-none focus:ring-red-500 focus:border-red-500' 
                    : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'
                } rounded`}
                placeholder="Enter first name"
                value={userFormData.firstName}
                onChange={handleUserFormChange}
              />
              {formErrors.firstName && (
                <p className="mt-1 text-sm text-red-600">{formErrors.firstName}</p>
              )}
            </div>
            
            <div className="col-span-1">
              <label htmlFor="lastName" className="block text-sm font-medium mb-1">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                className={`w-full p-2 border ${
                  formErrors.lastName 
                    ? 'border-red-300 text-red-900 placeholder-red-300 focus:outline-none focus:ring-red-500 focus:border-red-500' 
                    : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'
                } rounded`}
                placeholder="Enter last name"
                value={userFormData.lastName}
                onChange={handleUserFormChange}
              />
              {formErrors.lastName && (
                <p className="mt-1 text-sm text-red-600">{formErrors.lastName}</p>
              )}
            </div>
            
            <div className="col-span-2">
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                className={`w-full p-2 border ${
                  formErrors.email 
                    ? 'border-red-300 text-red-900 placeholder-red-300 focus:outline-none focus:ring-red-500 focus:border-red-500' 
                    : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'
                } rounded`}
                placeholder="Enter email address"
                value={userFormData.email}
                onChange={handleUserFormChange}
              />
              {formErrors.email && (
                <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
              )}
            </div>
            
            <div className="col-span-1">
              <label htmlFor="role" className="block text-sm font-medium mb-1">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                id="role"
                name="role"
                className={`w-full p-2 border ${
                  formErrors.role 
                    ? 'border-red-300 text-red-900 placeholder-red-300 focus:outline-none focus:ring-red-500 focus:border-red-500' 
                    : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'
                } rounded`}
                value={userFormData.role}
                onChange={handleUserFormChange}
              >
                <option value="">Select role</option>
                {rolesData.map(role => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              {formErrors.role && (
                <p className="mt-1 text-sm text-red-600">{formErrors.role}</p>
              )}
            </div>
            
            <div className="col-span-1">
              <label htmlFor="department" className="block text-sm font-medium mb-1">
                Department
              </label>
              <input
                type="text"
                id="department"
                name="department"
                className="w-full p-2 border border-gray-200 rounded"
                placeholder="Enter department"
                value={userFormData.department}
                onChange={handleUserFormChange}
              />
            </div>
            
            <div className="col-span-1">
              <label htmlFor="status" className="block text-sm font-medium mb-1">
                Status
              </label>
              <select
                id="status"
                name="status"
                className="w-full p-2 border border-gray-200 rounded"
                value={userFormData.status}
                onChange={handleUserFormChange}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            
            <div className="col-span-1">
              <div className="flex items-center h-full mt-5">
                <label className="flex items-center">
                  <input 
                    type="checkbox" 
                    id="sendEmail" 
                    name="sendEmail"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" 
                    checked={userFormData.sendEmail} 
                    onChange={handleUserFormChange}
                  />
                  <span className="ml-2 text-sm text-gray-700">Send Welcome Email</span>
                </label>
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex items-center bg-blue-50 p-3 rounded text-sm">
            <AlertCircle size={16} className="text-blue-500 mr-2 flex-shrink-0" />
            <span className="text-blue-700">
              A temporary password will be generated for the user{userFormData.sendEmail ? " and sent via email" : ""}.
            </span>
          </div>
        </div>
        
        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2 border border-gray-200 rounded"
            onClick={() => setShowAddUserModal(false)}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader size={16} className="animate-spin mr-2" />
                Creating...
              </>
            ) : "Add User"}
          </button>
        </div>
      </form>
    </div>
  </div>
)}

{/* Add Role Modal */}
{showAddRoleModal && mergedConfig.modals.addRole.enabled && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">{mergedConfig.modals.addRole.title}</h2>
          <button
            onClick={() => setShowAddRoleModal(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>
      </div>
      
      <form onSubmit={handleAddRole}>
        <div className="p-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Role Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                className={`w-full p-2 border ${
                  formErrors.name 
                    ? 'border-red-300 text-red-900 placeholder-red-300 focus:outline-none focus:ring-red-500 focus:border-red-500' 
                    : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'
                } rounded`}
                placeholder="Enter role name"
                value={roleFormData.name}
                onChange={handleRoleFormChange}
              />
              {formErrors.name && (
                <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                className={`w-full p-2 border ${
                  formErrors.description 
                    ? 'border-red-300 text-red-900 placeholder-red-300 focus:outline-none focus:ring-red-500 focus:border-red-500' 
                    : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'
                } rounded`}
                placeholder="Enter role description"
                value={roleFormData.description}
                onChange={handleRoleFormChange}
                rows={3}
              ></textarea>
              {formErrors.description && (
                <p className="mt-1 text-sm text-red-600">{formErrors.description}</p>
              )}
            </div>
          </div>
          
          <div className="mt-6">
  <h3 className="text-lg font-medium mb-4">Set Permissions</h3>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {Object.entries(permissionModules).map(([module, { label, actions }]) => (
      <div key={module} className="bg-gray-50 p-4 rounded">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-medium">{label}</h4>
          <button 
            type="button"
            className="text-xs text-blue-600 hover:text-blue-800"
            onClick={() => toggleModulePermissions(module)}
          >
            {actions.every(action => roleFormData.permissions[`${module}.${action}`]) ? 
              'Deselect All' : 'Select All'}
          </button>
        </div>
        <div className="space-y-2">
          {actions.map(action => (
            <div key={`${module}.${action}`} className="flex items-center">
              <input 
                type="checkbox" 
                id={`permission.${module}.${action}`}
                name={`permission.${module}.${action}`}
                checked={roleFormData.permissions[`${module}.${action}`] || false}
                onChange={handleRoleFormChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" 
              />
              <label 
                htmlFor={`permission.${module}.${action}`} 
                className="ml-2 text-sm text-gray-700 capitalize"
              >
                {action}
              </label>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
</div>
        </div>
        
        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2 border border-gray-200 rounded"
            onClick={() => setShowAddRoleModal(false)}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader size={16} className="animate-spin mr-2" />
                Creating...
              </>
            ) : "Add Role"}
          </button>
        </div>
      </form>
    </div>
  </div>
)}
      
{/* User Details Modal */}
{showUserDetailsModal && selectedUser && mergedConfig.modals.viewUser.enabled && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">{mergedConfig.modals.viewUser.title}</h2>
          <button
            onClick={() => setShowUserDetailsModal(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>
      </div>
      
      <div className="p-6">
        <div className="flex items-center mb-6">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-medium text-xl mr-4">
            {selectedUser.name ? selectedUser.name.split(' ').map(n => n[0]).join('').toUpperCase() : '?'}
          </div>
          <div>
            <h3 className="text-xl font-bold">{selectedUser.name}</h3>
            <div className="text-sm text-gray-500">{selectedUser.email}</div>
            <div className="flex items-center space-x-2 mt-2">
              <StatusBadge status={selectedUser.status || 'inactive'} statusConfig={mergedConfig.statusConfig} />
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {selectedUser.role || 'User'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Department</div>
            <div className="text-sm font-medium">{selectedUser.department || "—"}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Last Login</div>
            <div className="text-sm font-medium">{formatTimeAgo(selectedUser.lastLogin)}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Created</div>
            <div className="text-sm font-medium">{formatDate(selectedUser.createdAt)}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">User ID</div>
            <div className="text-sm font-medium">{selectedUser.id}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Email Verified</div>
            <div className="text-sm font-medium">
              {selectedUser.isEmailVerified ? (
                <span className="inline-flex items-center text-green-700">
                  <CheckCircle size={14} className="mr-1" />
                  Verified
                </span>
              ) : (
                <span className="inline-flex items-center text-red-700">
                  <XCircle size={14} className="mr-1" />
                  Not Verified
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="mb-6">
          <h4 className="font-medium mb-3 pb-2 border-b border-gray-200">
            Permissions (via {selectedUser.role || 'User'} role)
          </h4>
          
          {/* Find role permissions if available */}
          {(() => {
            const userRole = rolesData.find(r => r.name === selectedUser.role || r.id === selectedUser.roleId);
            
            if (userRole && userRole.permissions) {
              let permissionsObj;
              
              // Parse permissions if they're stored as a string
              if (typeof userRole.permissions === 'string') {
                try {
                  permissionsObj = JSON.parse(userRole.permissions);
                } catch (e) {
                  return (
                    <div className="text-sm text-gray-500">
                      Unable to display permissions. The data format is not supported.
                    </div>
                  );
                }
              } else {
                permissionsObj = userRole.permissions;
              }
              
              // Render permissions grid
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(permissionsObj).map(([category, perms]) => (
                    <div key={category} className="bg-gray-50 p-3 rounded">
                      <div className="text-sm font-medium mb-2 capitalize">
                        {category}
                      </div>
                      <div className="space-y-1">
                        {typeof perms === 'object' ? (
                          Object.entries(perms).map(([perm, allowed]) => (
                            <div key={perm} className="flex items-center text-sm">
                              {allowed ? (
                                <CheckCircle size={14} className="text-green-500 mr-2" />
                              ) : (
                                <XCircle size={14} className="text-red-500 mr-2" />
                              )}
                              <span className="capitalize">{perm}</span>
                            </div>
                          ))
                        ) : (
                          <div className="flex items-center text-sm">
                            {perms ? (
                              <CheckCircle size={14} className="text-green-500 mr-2" />
                            ) : (
                              <XCircle size={14} className="text-red-500 mr-2" />
                            )}
                            <span className="capitalize">{category}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            } else {
              return (
                <div className="text-sm text-gray-500">
                  No detailed permissions information available for this role.
                </div>
              );
            }
          })()}
        </div>
      </div>
      
      <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
        <button 
          className="px-4 py-2 border border-gray-200 rounded"
          onClick={() => setShowUserDetailsModal(false)}
        >
          Close
        </button>
        <button 
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={() => {
            setShowUserDetailsModal(false);
            handleEditUser(selectedUser);
          }}
        >
          Edit User
        </button>
      </div>
    </div>
  </div>
)}

{/* Role Details Modal */}
{showRoleDetailsModal && selectedRole && mergedConfig.modals.viewRole.enabled && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">{mergedConfig.modals.viewRole.title}</h2>
          <button
            onClick={() => setShowRoleDetailsModal(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>
      </div>
      
      <div className="p-6">
        <div className="flex items-center mb-6">
          <div className="bg-blue-100 text-blue-700 p-3 rounded-full mr-4">
            <Shield size={20} />
          </div>
          <div>
            <h3 className="text-xl font-bold">{selectedRole.name}</h3>
            <p className="text-sm text-gray-500 mt-1">{selectedRole.description}</p>
          </div>
        </div>
        
        <div className="mb-4 bg-gray-50 p-3 rounded">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Users with this role</div>
          <div className="text-xl font-semibold">
            {typeof selectedRole.users === 'number' ? selectedRole.users : 
             Array.isArray(selectedRole.users) ? selectedRole.users.length : 
             Array.isArray(selectedRole.assignedUsers) ? selectedRole.assignedUsers.length : 0}
          </div>
        </div>
        
        <div className="mb-6">
          <h4 className="font-medium mb-3 pb-2 border-b border-gray-200">
            Permissions
          </h4>
          
          {(() => {
            if (!selectedRole.permissions) {
              return (
                <div className="text-sm text-gray-500">
                  No permissions information available.
                </div>
              );
            }
            
            let permissionsObj;
            
            // Parse permissions if they're stored as a string
            if (typeof selectedRole.permissions === 'string') {
              try {
                permissionsObj = JSON.parse(selectedRole.permissions);
              } catch (e) {
                return (
                  <div className="text-sm text-gray-500">
                    Unable to display permissions. The data format is not supported.
                  </div>
                );
              }
            } else {
              permissionsObj = selectedRole.permissions;
            }
            
            // Render permissions table
            return (
              <div className="overflow-x-auto border border-gray-200 rounded">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Permission</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Access</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(permissionsObj).map(([category, perms]) => 
                      typeof perms === 'object' ? (
                        Object.entries(perms).map(([perm, allowed], permIndex) => (
                          <tr key={`${category}-${perm}`}>
                            {permIndex === 0 && (
                              <td 
                                rowSpan={Object.keys(perms).length} 
                                className="px-4 py-3 whitespace-nowrap text-sm font-medium bg-gray-50 capitalize"
                              >
                                {category}
                              </td>
                            )}
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 capitalize">
                              {perm}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                allowed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {allowed ? (
                                  <CheckCircle size={12} className="mr-1" />
                                ) : (
                                  <XCircle size={12} className="mr-1" />
                                )}
                                {allowed ? 'Yes' : 'No'}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr key={category}>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium capitalize">
                            {category}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            —
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              perms ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {perms ? (
                                <CheckCircle size={12} className="mr-1" />
                              ) : (
                                <XCircle size={12} className="mr-1" />
                              )}
                              {perms ? 'Yes' : 'No'}
                            </span>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
        
        {Array.isArray(selectedRole.assignedUsers) && selectedRole.assignedUsers.length > 0 && (
          <div className="mb-6">
            <h4 className="font-medium mb-3 pb-2 border-b border-gray-200">
              Assigned Users
            </h4>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
              {selectedRole.assignedUsers.map(user => (
                <div key={user.id} className="flex items-center p-2 bg-gray-50 rounded">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-medium mr-3">
                    {user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : '?'}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{user.name}</div>
                    <div className="text-xs text-gray-500">{user.email}</div>
                  </div>
                  {user.status && (
                    <StatusBadge status={user.status} statusConfig={mergedConfig.statusConfig} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
        <button 
          className="px-4 py-2 border border-gray-200 rounded"
          onClick={() => setShowRoleDetailsModal(false)}
        >
          Close
        </button>
        <button 
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={() => {
            setShowRoleDetailsModal(false);
            handleEditRole(selectedRole);
          }}
        >
          Edit Role
        </button>
      </div>
    </div>
  </div>
)}
{/* Assign Users Modal */}
{showAssignUsersModal && selectedRoleForUsers && (
  <AssignUsersModal
    isOpen={showAssignUsersModal}
    onClose={() => setShowAssignUsersModal(false)}
    roleId={selectedRoleForUsers.id}
    roleName={selectedRoleForUsers.name}
    onSuccess={handleUsersAssigned}
  />
)}
{toast && (
  <Toast 
    message={toast.message} 
    type={toast.type} 
    onClose={() => setToast(null)} 
  />
)}

{/* Edit User Modal */}
{showEditUserModal && editingUser && mergedConfig.modals.addUser.enabled && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Edit User</h2>
          <button
            onClick={() => {
              setShowEditUserModal(false);
              setEditingUser(null);
            }}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>
      </div>
      
      <form onSubmit={handleUpdateUser}>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-1">
              <label htmlFor="edit-firstName" className="block text-sm font-medium mb-1">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="edit-firstName"
                name="firstName"
                className={`w-full p-2 border ${
                  formErrors.firstName 
                    ? 'border-red-300 text-red-900 placeholder-red-300 focus:outline-none focus:ring-red-500 focus:border-red-500' 
                    : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'
                } rounded`}
                placeholder="Enter first name"
                value={editingUser.firstName}
                onChange={(e) => setEditingUser({...editingUser, firstName: e.target.value})}
              />
              {formErrors.firstName && (
                <p className="mt-1 text-sm text-red-600">{formErrors.firstName}</p>
              )}
            </div>
            
            <div className="col-span-1">
              <label htmlFor="edit-lastName" className="block text-sm font-medium mb-1">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="edit-lastName"
                name="lastName"
                className={`w-full p-2 border ${
                  formErrors.lastName 
                    ? 'border-red-300 text-red-900 placeholder-red-300 focus:outline-none focus:ring-red-500 focus:border-red-500' 
                    : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'
                } rounded`}
                placeholder="Enter last name"
                value={editingUser.lastName}
                onChange={(e) => setEditingUser({...editingUser, lastName: e.target.value})}
              />
              {formErrors.lastName && (
                <p className="mt-1 text-sm text-red-600">{formErrors.lastName}</p>
              )}
            </div>
            
            <div className="col-span-2">
              <label htmlFor="edit-email" className="block text-sm font-medium mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="edit-email"
                name="email"
                className={`w-full p-2 border ${
                  formErrors.email 
                    ? 'border-red-300 text-red-900 placeholder-red-300 focus:outline-none focus:ring-red-500 focus:border-red-500' 
                    : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'
                } rounded`}
                placeholder="Enter email address"
                value={editingUser.email}
                onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
              />
              {formErrors.email && (
                <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
              )}
            </div>
            
            <div className="col-span-1">
              <label htmlFor="edit-role" className="block text-sm font-medium mb-1">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                id="edit-role"
                name="role"
                className={`w-full p-2 border ${
                  formErrors.role 
                    ? 'border-red-300 text-red-900 placeholder-red-300 focus:outline-none focus:ring-red-500 focus:border-red-500' 
                    : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'
                } rounded`}
                value={editingUser.role}
                onChange={(e) => setEditingUser({...editingUser, role: e.target.value})}
              >
                <option value="">Select role</option>
                {rolesData.map(role => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              {formErrors.role && (
                <p className="mt-1 text-sm text-red-600">{formErrors.role}</p>
              )}
            </div>
            
            <div className="col-span-1">
              <label htmlFor="edit-department" className="block text-sm font-medium mb-1">
                Department
              </label>
              <input
                type="text"
                id="edit-department"
                name="department"
                className="w-full p-2 border border-gray-200 rounded"
                placeholder="Enter department"
                value={editingUser.department}
                onChange={(e) => setEditingUser({...editingUser, department: e.target.value})}
              />
            </div>
            
            <div className="col-span-1">
              <label htmlFor="edit-status" className="block text-sm font-medium mb-1">
                Status
              </label>
              <select
                id="edit-status"
                name="status"
                className="w-full p-2 border border-gray-200 rounded"
                value={editingUser.status}
                onChange={(e) => setEditingUser({...editingUser, status: e.target.value})}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="deleted">Deleted</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2 border border-gray-200 rounded"
            onClick={() => {
              setShowEditUserModal(false);
              setEditingUser(null);
            }}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader size={16} className="animate-spin mr-2" />
                Updating...
              </>
            ) : "Update User"}
          </button>
        </div>
      </form>
    </div>
  </div>
)}

{/* Edit Role Modal */}
{showEditRoleModal && editingRole && mergedConfig.modals.addRole.enabled && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Edit Role</h2>
          <button
            onClick={() => {
              setShowEditRoleModal(false);
              setEditingRole(null);
            }}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>
      </div>
      
      <form onSubmit={handleUpdateRole}>
        <div className="p-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="edit-role-name" className="block text-sm font-medium mb-1">
                Role Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="edit-role-name"
                name="name"
                className={`w-full p-2 border ${
                  formErrors.name 
                    ? 'border-red-300 text-red-900 placeholder-red-300 focus:outline-none focus:ring-red-500 focus:border-red-500' 
                    : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'
                } rounded`}
                placeholder="Enter role name"
                value={editingRole.name}
                onChange={(e) => setEditingRole({...editingRole, name: e.target.value})}
              />
              {formErrors.name && (
                <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="edit-role-description" className="block text-sm font-medium mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="edit-role-description"
                name="description"
                className={`w-full p-2 border ${
                  formErrors.description 
                    ? 'border-red-300 text-red-900 placeholder-red-300 focus:outline-none focus:ring-red-500 focus:border-red-500' 
                    : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'
                } rounded`}
                placeholder="Enter role description"
                value={editingRole.description}
                onChange={(e) => setEditingRole({...editingRole, description: e.target.value})}
                rows={3}
              ></textarea>
              {formErrors.description && (
                <p className="mt-1 text-sm text-red-600">{formErrors.description}</p>
              )}
            </div>
          </div>
          
          <div className="mt-6">
            <h3 className="text-lg font-medium mb-4">Update Permissions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(permissionModules).map(([module, { label, actions }]) => (
                <div key={module} className="bg-gray-50 p-4 rounded">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium">{label}</h4>
                    <button 
                      type="button"
                      className="text-xs text-blue-600 hover:text-blue-800"
                      onClick={() => {
                        const allEnabled = actions.every(action => editingRole.permissions[`${module}.${action}`]);
                        const updatedPermissions = { ...editingRole.permissions };
                        actions.forEach(action => {
                          updatedPermissions[`${module}.${action}`] = !allEnabled;
                        });
                        setEditingRole({...editingRole, permissions: updatedPermissions});
                      }}
                    >
                      {actions.every(action => editingRole.permissions[`${module}.${action}`]) ? 
                        'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {actions.map(action => (
                      <div key={`${module}.${action}`} className="flex items-center">
                        <input 
                          type="checkbox" 
                          id={`edit-permission.${module}.${action}`}
                          name={`permission.${module}.${action}`}
                          checked={editingRole.permissions[`${module}.${action}`] || false}
                          onChange={(e) => {
                            const updatedPermissions = {
                              ...editingRole.permissions,
                              [`${module}.${action}`]: e.target.checked
                            };
                            setEditingRole({...editingRole, permissions: updatedPermissions});
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" 
                        />
                        <label 
                          htmlFor={`edit-permission.${module}.${action}`} 
                          className="ml-2 text-sm text-gray-700 capitalize"
                        >
                          {action}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2 border border-gray-200 rounded"
            onClick={() => {
              setShowEditRoleModal(false);
              setEditingRole(null);
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader size={16} className="animate-spin mr-2" />
                Updating...
              </>
            ) : "Update Role"}
          </button>
        </div>
      </form>
    </div>
  </div>
)}

{/* Assign Users Modal */}
{showAssignUsersModal && selectedRoleForUsers && (
  <AssignUsersModal
    isOpen={showAssignUsersModal}
    onClose={() => setShowAssignUsersModal(false)}
    roleId={selectedRoleForUsers.id}
    roleName={selectedRoleForUsers.name}
    onSuccess={handleUsersAssigned}
  />
)}
{toast && (
  <Toast 
    message={toast.message} 
    type={toast.type} 
    onClose={() => setToast(null)} 
  />
)}


    </div>
    </PermissionGuard>
  );
};

export default UserRoleManagement;