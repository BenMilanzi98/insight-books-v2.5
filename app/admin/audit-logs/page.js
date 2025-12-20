"use client";
import { useState, useEffect } from 'react';
import { FileText, Shield, User, Activity, Clock, Search, Filter } from 'lucide-react';

export default function AdminAuditLogs() {
  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      setLogs([
        {
          id: 1,
          action: 'LOGIN',
          entityType: 'ADMIN',
          user: 'admin@insightbooks.com',
          timestamp: '2025-01-27T10:30:00Z',
          details: 'Admin logged in successfully',
          ipAddress: '192.168.1.100',
          severity: 'info'
        },
        {
          id: 2,
          action: 'TENANT_CREATE',
          entityType: 'TENANT',
          user: 'admin@insightbooks.com',
          timestamp: '2025-01-27T09:15:00Z',
          details: 'Created new tenant: TechCorp Solutions',
          ipAddress: '192.168.1.100',
          severity: 'info'
        },
        {
          id: 3,
          action: 'USER_SUSPEND',
          entityType: 'USER',
          user: 'admin@insightbooks.com',
          timestamp: '2025-01-27T08:45:00Z',
          details: 'Suspended user account: john.doe@techcorp.com',
          ipAddress: '192.168.1.100',
          severity: 'warning'
        },
        {
          id: 4,
          action: 'SETTINGS_UPDATE',
          entityType: 'SYSTEM',
          user: 'admin@insightbooks.com',
          timestamp: '2025-01-27T08:00:00Z',
          details: 'Updated global system settings',
          ipAddress: '192.168.1.100',
          severity: 'info'
        },
        {
          id: 5,
          action: 'SECURITY_ALERT',
          entityType: 'SYSTEM',
          user: 'system',
          timestamp: '2025-01-27T07:30:00Z',
          details: 'Multiple failed login attempts detected',
          ipAddress: '203.0.113.45',
          severity: 'error'
        }
      ]);
      setIsLoading(false);
    }, 1000);
  }, []);

  const getSeverityBadge = (severity) => {
    const styles = {
      info: 'bg-blue-100 text-blue-800',
      warning: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800'
    };
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[severity] || styles.info}`}>
        {severity.toUpperCase()}
      </span>
    );
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.action.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = activeFilter === 'all' || log.severity === activeFilter;
    
    return matchesSearch && matchesFilter;
  });

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit & Security Logs</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor system activity, security events, and administrative actions
          </p>
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
              <p className="text-sm font-medium text-gray-600">Total Logs</p>
              <p className="text-2xl font-bold text-gray-900">{logs.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Shield className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Info Events</p>
              <p className="text-2xl font-bold text-gray-900">
                {logs.filter(log => log.severity === 'info').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <FileText className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Warnings</p>
              <p className="text-2xl font-bold text-gray-900">
                {logs.filter(log => log.severity === 'warning').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <Activity className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Errors</p>
              <p className="text-2xl font-bold text-gray-900">
                {logs.filter(log => log.severity === 'error').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setActiveFilter("all")}
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  activeFilter === "all"
                    ? "bg-indigo-100 text-indigo-700"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveFilter("info")}
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  activeFilter === "info"
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-500 hover:text-blue-700"
                }`}
              >
                Info
              </button>
              <button
                onClick={() => setActiveFilter("warning")}
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  activeFilter === "warning"
                    ? "bg-yellow-100 text-yellow-700"
                    : "text-gray-500 hover:text-yellow-700"
                }`}
              >
                Warnings
              </button>
              <button
                onClick={() => setActiveFilter("error")}
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  activeFilter === "error"
                    ? "bg-red-100 text-red-700"
                    : "text-gray-500 hover:text-red-700"
                }`}
              >
                Errors
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Severity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IP Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{log.action}</div>
                    <div className="text-sm text-gray-500">{log.entityType}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.user}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                    <div className="truncate">{log.details}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getSeverityBadge(log.severity)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.ipAddress}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatTimestamp(log.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredLogs.length === 0 && (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No logs found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || activeFilter !== 'all' ? 'No logs match your filters' : 'No audit logs available'}
          </p>
        </div>
      )}
    </div>
  );
}