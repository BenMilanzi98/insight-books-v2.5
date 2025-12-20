"use client";

import React, { useState, useEffect } from "react";
import { 
  Shield,
  Activity,
  Users,
  Calendar,
  Search,
  Filter,
  Download,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  Database,
  FileText,
  Settings,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from "lucide-react";

const AuditPage = () => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [adminAuditLogs, setAdminAuditLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedLogType, setSelectedLogType] = useState("all");
  const [dateRange, setDateRange] = useState("7d");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAction, setSelectedAction] = useState("all");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchAuditData();
  }, [dateRange]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedLogType, selectedAction, searchTerm]);

  const fetchAuditData = async () => {
    try {
      setIsLoading(true);
      const [auditResponse, adminAuditResponse] = await Promise.all([
        fetch('/api/admin/audit/logs'),
        fetch('/api/admin/audit/admin-logs')
      ]);

      if (auditResponse.ok) {
        const auditData = await auditResponse.json();
        setAuditLogs(auditData.logs || []);
      }

      if (adminAuditResponse.ok) {
        const adminAuditData = await adminAuditResponse.json();
        setAdminAuditLogs(adminAuditData.logs || []);
      }
    } catch (error) {
      setError('Failed to fetch audit data');
      console.error('Audit fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'LOGIN':
      case 'LOGIN_SUCCESS':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'LOGIN_FAILED':
      case 'UNAUTHORIZED_ACCESS':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'USER_CREATE':
      case 'USER_UPDATE':
      case 'USER_DELETE':
        return <Users className="h-4 w-4 text-blue-500" />;
      case 'TENANT_CREATE':
      case 'TENANT_UPDATE':
      case 'TENANT_DELETE':
        return <Database className="h-4 w-4 text-purple-500" />;
      case 'SETTINGS_UPDATE':
        return <Settings className="h-4 w-4 text-orange-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActionBadge = (action) => {
    const actionColors = {
      'LOGIN': 'bg-green-100 text-green-800',
      'LOGIN_SUCCESS': 'bg-green-100 text-green-800',
      'LOGIN_FAILED': 'bg-red-100 text-red-800',
      'UNAUTHORIZED_ACCESS': 'bg-red-100 text-red-800',
      'USER_CREATE': 'bg-blue-100 text-blue-800',
      'USER_UPDATE': 'bg-blue-100 text-blue-800',
      'USER_DELETE': 'bg-red-100 text-red-800',
      'TENANT_CREATE': 'bg-purple-100 text-purple-800',
      'TENANT_UPDATE': 'bg-purple-100 text-purple-800',
      'TENANT_DELETE': 'bg-red-100 text-red-800',
      'SETTINGS_UPDATE': 'bg-orange-100 text-orange-800'
    };
    return actionColors[action] || 'bg-gray-100 text-gray-800';
  };

  const exportAuditData = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Timestamp,Action,User,IP Address,Details,Status\n" +
      [...auditLogs, ...adminAuditLogs]
        .map(log => `${log.timestamp || log.createdAt},${log.action},${log.user || log.adminId},${log.ipAddress || 'N/A'},${log.details || 'N/A'},${log.status || 'Success'}`)
        .join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredLogs = [...auditLogs, ...adminAuditLogs]
    .filter(log => {
      const matchesType = selectedLogType === "all" || 
        (selectedLogType === "user" && auditLogs.includes(log)) ||
        (selectedLogType === "admin" && adminAuditLogs.includes(log));
      
      const matchesAction = selectedAction === "all" || log.action === selectedAction;
      const matchesSearch = searchTerm === "" || 
        log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.user?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.adminId?.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesType && matchesAction && matchesSearch;
    })
    .sort((a, b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || b.createdAt));

  // Calculate pagination
  const totalItems = filteredLogs.length;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentPageData = filteredLogs.slice(startIndex, endIndex);

  // Update total pages when filtered data changes
  useEffect(() => {
    const newTotalPages = Math.ceil(filteredLogs.length / pageSize);
    setTotalPages(newTotalPages);
    if (currentPage > newTotalPages && newTotalPages > 0) {
      setCurrentPage(1);
    }
  }, [filteredLogs.length, pageSize, currentPage]);

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const goToFirstPage = () => goToPage(1);
  const goToLastPage = () => goToPage(totalPages);
  const goToNextPage = () => goToPage(currentPage + 1);
  const goToPreviousPage = () => goToPage(currentPage - 1);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit & Security</h1>
          <p className="text-sm text-gray-500">Monitor system activities and security events</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={exportAuditData}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
          <button
            onClick={fetchAuditData}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Activity className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Activities</p>
              <p className="text-2xl font-bold text-gray-900">{filteredLogs.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Users className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">User Activities</p>
              <p className="text-2xl font-bold text-gray-900">{auditLogs.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Shield className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Admin Activities</p>
              <p className="text-2xl font-bold text-gray-900">{adminAuditLogs.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Security Events</p>
              <p className="text-2xl font-bold text-gray-900">
                {filteredLogs.filter(log => 
                  log.action?.includes('FAILED') || 
                  log.action?.includes('UNAUTHORIZED') ||
                  log.action?.includes('DELETE')
                ).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>
          
          <select
            value={selectedLogType}
            onChange={(e) => setSelectedLogType(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="all">All Logs</option>
            <option value="user">User Activities</option>
            <option value="admin">Admin Activities</option>
          </select>

          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="all">All Actions</option>
            <option value="LOGIN">Login</option>
            <option value="USER_CREATE">User Create</option>
            <option value="USER_UPDATE">User Update</option>
            <option value="USER_DELETE">User Delete</option>
            <option value="TENANT_CREATE">Tenant Create</option>
            <option value="TENANT_UPDATE">Tenant Update</option>
            <option value="TENANT_DELETE">Tenant Delete</option>
            <option value="SETTINGS_UPDATE">Settings Update</option>
          </select>

          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="1d">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>

          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search activities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm w-64"
            />
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Activity Logs</h3>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-500">
                Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} results
              </span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border border-gray-300 rounded-md px-2 py-1 text-sm"
              >
                <option value={5}>5 per page</option>
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User/Admin
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IP Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentPageData.length > 0 ? (
                currentPageData.map((log, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getActionIcon(log.action)}
                        <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionBadge(log.action)}`}>
                          {log.action}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.user || log.adminId || 'System'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {log.details || 'No details provided'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.ipAddress || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(log.timestamp || log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        log.action?.includes('FAILED') || log.action?.includes('UNAUTHORIZED') 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {log.action?.includes('FAILED') || log.action?.includes('UNAUTHORIZED') ? 'Failed' : 'Success'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                    {searchTerm || selectedAction !== 'all' || selectedLogType !== 'all' 
                      ? 'No activities match your filters' 
                      : 'No activities found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                <span className="font-medium">{Math.min(endIndex, totalItems)}</span> of{' '}
                <span className="font-medium">{totalItems}</span> results
              </div>
              
              <div className="flex items-center space-x-2">
                {/* First Page */}
                <button
                  onClick={goToFirstPage}
                  disabled={currentPage === 1}
                  className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </button>
                
                {/* Previous Page */}
                <button
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                  className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                
                {/* Page Numbers */}
                <div className="flex items-center space-x-1">
                  {getPageNumbers().map((page, index) => (
                    <button
                      key={index}
                      onClick={() => typeof page === 'number' && goToPage(page)}
                      disabled={page === '...'}
                      className={`px-3 py-2 text-sm font-medium rounded-md ${
                        page === currentPage
                          ? 'bg-indigo-600 text-white'
                          : page === '...'
                          ? 'text-gray-400 cursor-default'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                
                {/* Next Page */}
                <button
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                
                {/* Last Page */}
                <button
                  onClick={goToLastPage}
                  disabled={currentPage === totalPages}
                  className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronsRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditPage; 