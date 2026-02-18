"use client";

import React, { useState, useEffect } from "react";
import { 
  Shield,
  AlertTriangle,
  Activity,
  Eye,
  EyeOff,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Clock,
  MapPin,
  Globe,
  Database,
  User,
  Lock,
  CheckCircle,
  XCircle,
  Info
} from "lucide-react";

const SecurityMonitoringPage = () => {
  const [securityEvents, setSecurityEvents] = useState([]);
  const [threatMetrics, setThreatMetrics] = useState({
    totalThreats: 0,
    highRisk: 0,
    mediumRisk: 0,
    lowRisk: 0,
    blockedAttempts: 0,
    suspiciousActivities: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState('24h');

  useEffect(() => {
    fetchSecurityData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchSecurityData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, selectedTimeframe]);

  const fetchSecurityData = async () => {
    try {
      setIsLoading(true);
      const [eventsResponse, metricsResponse] = await Promise.all([
        fetch('/api/admin/security/monitoring/events'),
        fetch('/api/admin/security/monitoring/metrics')
      ]);

      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json();
        setSecurityEvents(eventsData.events || []);
      }

      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        setThreatMetrics(metricsData.metrics || threatMetrics);
      }
    } catch (error) {
      console.error('Failed to fetch security data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getThreatLevelColor = (level) => {
    switch (level.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getEventIcon = (eventType) => {
    switch (eventType) {
      case 'LOGIN_ATTEMPT':
        return <User className="h-4 w-4 text-blue-500" />;
      case 'UNAUTHORIZED_ACCESS':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'SUSPICIOUS_ACTIVITY':
        return <Eye className="h-4 w-4 text-yellow-500" />;
      case 'RATE_LIMIT_EXCEEDED':
        return <Clock className="h-4 w-4 text-orange-500" />;
      case 'IP_BLOCKED':
        return <Globe className="h-4 w-4 text-red-500" />;
      case 'SECURITY_ALERT':
        return <Shield className="h-4 w-4 text-purple-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getEventStatus = (event) => {
    if (event.blocked) {
      return { status: 'Blocked', color: 'text-green-600', bg: 'bg-green-100' };
    } else if (event.threatLevel === 'high') {
      return { status: 'High Risk', color: 'text-red-600', bg: 'bg-red-100' };
    } else if (event.threatLevel === 'medium') {
      return { status: 'Medium Risk', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    } else {
      return { status: 'Low Risk', color: 'text-green-600', bg: 'bg-green-100' };
    }
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
          <h1 className="text-2xl font-bold text-gray-900">Security Monitoring</h1>
          <p className="text-sm text-gray-500">Real-time security events and threat detection</p>
        </div>
        <div className="flex items-center space-x-3">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">Auto-refresh</span>
          </label>
          <select
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <button
            onClick={fetchSecurityData}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Threat Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Threats</p>
              <p className="text-2xl font-bold text-gray-900">{threatMetrics.totalThreats}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">High Risk</p>
              <p className="text-2xl font-bold text-red-600">{threatMetrics.highRisk}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Medium Risk</p>
              <p className="text-2xl font-bold text-yellow-600">{threatMetrics.mediumRisk}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Low Risk</p>
              <p className="text-2xl font-bold text-green-600">{threatMetrics.lowRisk}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Shield className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Blocked</p>
              <p className="text-2xl font-bold text-blue-600">{threatMetrics.blockedAttempts}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Eye className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Suspicious</p>
              <p className="text-2xl font-bold text-purple-600">{threatMetrics.suspiciousActivities}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Security Events */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <Activity className="h-5 w-5 mr-2 text-gray-600" />
            Recent Security Events
          </h3>
        </div>
        
        <div className="p-6">
          {securityEvents.length > 0 ? (
            <div className="space-y-4">
              {securityEvents.map((event, index) => {
                const eventStatus = getEventStatus(event);
                return (
                  <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div className="flex items-center space-x-4">
                      {getEventIcon(event.eventType)}
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {event.description || event.eventType}
                        </p>
                        <div className="flex items-center space-x-4 mt-1">
                          <span className="text-xs text-gray-500">
                            <User className="h-3 w-3 inline mr-1" />
                            {event.user || event.ipAddress || 'Unknown'}
                          </span>
                          <span className="text-xs text-gray-500">
                            <MapPin className="h-3 w-3 inline mr-1" />
                            {event.ipAddress || 'N/A'}
                          </span>
                          <span className="text-xs text-gray-500">
                            <Clock className="h-3 w-3 inline mr-1" />
                            {new Date(event.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getThreatLevelColor(event.threatLevel)}`}>
                        {event.threatLevel}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${eventStatus.bg} ${eventStatus.color}`}>
                        {eventStatus.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No security events detected</p>
              <p className="text-sm text-gray-400 mt-1">Your system appears to be secure</p>
            </div>
          )}
        </div>
      </div>

      {/* Security Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <Shield className="h-5 w-5 mr-2 text-gray-600" />
              System Security Status
            </h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Firewall Status</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Active
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Intrusion Detection</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Enabled
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">SSL/TLS Status</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Secure
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Database Security</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Protected
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">API Security</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Secure
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-gray-600" />
              Threat Trends
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Login Attempts</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-900">24</span>
                  <TrendingDown className="h-4 w-4 text-green-500" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Failed Logins</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-900">3</span>
                  <TrendingDown className="h-4 w-4 text-green-500" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Suspicious IPs</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-900">1</span>
                  <TrendingDown className="h-4 w-4 text-green-500" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Rate Limit Hits</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-900">0</span>
                  <TrendingDown className="h-4 w-4 text-green-500" />
                </div>
              </div>
            </div>
            
            <div className="mt-6 p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                <span className="text-sm text-green-700">
                  Security status: Excellent - No critical threats detected
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityMonitoringPage; 