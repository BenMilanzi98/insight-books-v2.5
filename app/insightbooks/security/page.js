"use client";

import React, { useState, useEffect } from "react";
import { 
  Shield,
  Lock,
  Eye,
  EyeOff,
  Save,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  Key,
  Smartphone,
  Globe,
  Database,
  RefreshCw,
  Trash2,
  Plus
} from "lucide-react";

const SecurityPage = () => {
  const [securitySettings, setSecuritySettings] = useState({
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      maxAge: 90
    },
    mfaSettings: {
      enabled: true,
      requireForAdmins: true,
      requireForUsers: false,
      allowedMethods: ['totp', 'sms', 'email']
    },
    sessionSettings: {
      maxSessionDuration: 24,
      idleTimeout: 30,
      maxConcurrentSessions: 3,
      requireReauthForSensitive: true
    },
    securityFeatures: {
      rateLimiting: true,
      ipWhitelist: false,
      suspiciousActivityDetection: true,
      auditLogging: true
    }
  });

  const [activeSessions, setActiveSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newIpAddress, setNewIpAddress] = useState("");
  const [whitelistedIPs, setWhitelistedIPs] = useState([
    "127.0.0.1",
    "::1"
  ]);

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const fetchSecurityData = async () => {
    try {
      setIsLoading(true);
      // Fetch current security settings and active sessions
      const [settingsResponse, sessionsResponse] = await Promise.all([
        fetch('/api/admin/security/settings'),
        fetch('/api/admin/security/sessions')
      ]);

      if (settingsResponse.ok) {
        const settings = await settingsResponse.json();
        setSecuritySettings(settings.settings || securitySettings);
      }

      if (sessionsResponse.ok) {
        const sessions = await sessionsResponse.json();
        setActiveSessions(sessions.sessions || []);
      }
    } catch (error) {
      console.error('Failed to fetch security data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setIsLoading(true);
      setSaveStatus("");

      const response = await fetch('/api/admin/security/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ settings: securitySettings }),
      });

      if (response.ok) {
        setSaveStatus("success");
        setTimeout(() => setSaveStatus(""), 3000);
      } else {
        setSaveStatus("error");
      }
    } catch (error) {
      setSaveStatus("error");
      console.error('Failed to save settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTerminateSession = async (sessionId) => {
    try {
      const response = await fetch(`/api/admin/security/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setActiveSessions(prev => prev.filter(session => session.id !== sessionId));
      }
    } catch (error) {
      console.error('Failed to terminate session:', error);
    }
  };

  const addWhitelistedIP = () => {
    if (newIpAddress && !whitelistedIPs.includes(newIpAddress)) {
      setWhitelistedIPs(prev => [...prev, newIpAddress]);
      setNewIpAddress("");
    }
  };

  const removeWhitelistedIP = (ip) => {
    setWhitelistedIPs(prev => prev.filter(ipAddr => ipAddr !== ip));
  };

  const getSessionStatus = (session) => {
    const now = new Date();
    const lastActivity = new Date(session.lastActivity);
    const idleMinutes = Math.floor((now - lastActivity) / (1000 * 60));
    
    if (idleMinutes > securitySettings.sessionSettings.idleTimeout) {
      return { status: 'idle', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    }
    return { status: 'active', color: 'text-green-600', bg: 'bg-green-100' };
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
          <h1 className="text-2xl font-bold text-gray-900">Security Settings</h1>
          <p className="text-sm text-gray-500">Configure system security policies and settings</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchSecurityData}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={handleSaveSettings}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Settings
          </button>
        </div>
      </div>

      {/* Save Status */}
      {saveStatus && (
        <div className={`p-4 rounded-md ${
          saveStatus === 'success' 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex">
            {saveStatus === 'success' ? (
              <CheckCircle className="h-5 w-5 text-green-400" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-400" />
            )}
            <div className="ml-3">
              <h3 className={`text-sm font-medium ${
                saveStatus === 'success' ? 'text-green-800' : 'text-red-800'
              }`}>
                {saveStatus === 'success' ? 'Settings saved successfully!' : 'Failed to save settings'}
              </h3>
            </div>
          </div>
        </div>
      )}

      {/* Password Policy */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <Lock className="h-5 w-5 mr-2 text-gray-600" />
            Password Policy
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Length
              </label>
              <input
                type="number"
                min="6"
                max="32"
                value={securitySettings.passwordPolicy.minLength}
                onChange={(e) => setSecuritySettings(prev => ({
                  ...prev,
                  passwordPolicy: {
                    ...prev.passwordPolicy,
                    minLength: parseInt(e.target.value)
                  }
                }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Age (days)
              </label>
              <input
                type="number"
                min="30"
                max="365"
                value={securitySettings.passwordPolicy.maxAge}
                onChange={(e) => setSecuritySettings(prev => ({
                  ...prev,
                  passwordPolicy: {
                    ...prev.passwordPolicy,
                    maxAge: parseInt(e.target.value)
                  }
                }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
          </div>
          
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={securitySettings.passwordPolicy.requireUppercase}
                onChange={(e) => setSecuritySettings(prev => ({
                  ...prev,
                  passwordPolicy: {
                    ...prev.passwordPolicy,
                    requireUppercase: e.target.checked
                  }
                }))}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Require uppercase letters</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={securitySettings.passwordPolicy.requireLowercase}
                onChange={(e) => setSecuritySettings(prev => ({
                  ...prev,
                  passwordPolicy: {
                    ...prev.passwordPolicy,
                    requireLowercase: e.target.checked
                  }
                }))}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Require lowercase letters</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={securitySettings.passwordPolicy.requireNumbers}
                onChange={(e) => setSecuritySettings(prev => ({
                  ...prev,
                  passwordPolicy: {
                    ...prev.passwordPolicy,
                    requireNumbers: e.target.checked
                  }
                }))}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Require numbers</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={securitySettings.passwordPolicy.requireSpecialChars}
                onChange={(e) => setSecuritySettings(prev => ({
                  ...prev,
                  passwordPolicy: {
                    ...prev.passwordPolicy,
                    requireSpecialChars: e.target.checked
                  }
                }))}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Require special characters</span>
            </label>
          </div>
        </div>
      </div>

      {/* MFA Settings */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <Smartphone className="h-5 w-5 mr-2 text-gray-600" />
            Multi-Factor Authentication
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={securitySettings.mfaSettings.enabled}
                onChange={(e) => setSecuritySettings(prev => ({
                  ...prev,
                  mfaSettings: {
                    ...prev.mfaSettings,
                    enabled: e.target.checked
                  }
                }))}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Enable MFA for all users</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={securitySettings.mfaSettings.requireForAdmins}
                onChange={(e) => setSecuritySettings(prev => ({
                  ...prev,
                  mfaSettings: {
                    ...prev.mfaSettings,
                    requireForAdmins: e.target.checked
                  }
                }))}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Require MFA for administrators</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={securitySettings.mfaSettings.requireForUsers}
                onChange={(e) => setSecuritySettings(prev => ({
                  ...prev,
                  mfaSettings: {
                    ...prev.mfaSettings,
                    requireForUsers: e.target.checked
                  }
                }))}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Require MFA for regular users</span>
            </label>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Allowed MFA Methods
            </label>
            <div className="space-y-2">
              {['totp', 'sms', 'email'].map((method) => (
                <label key={method} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={securitySettings.mfaSettings.allowedMethods.includes(method)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSecuritySettings(prev => ({
                          ...prev,
                          mfaSettings: {
                            ...prev.mfaSettings,
                            allowedMethods: [...prev.mfaSettings.allowedMethods, method]
                          }
                        }));
                      } else {
                        setSecuritySettings(prev => ({
                          ...prev,
                          mfaSettings: {
                            ...prev.mfaSettings,
                            allowedMethods: prev.mfaSettings.allowedMethods.filter(m => m !== method)
                          }
                        }));
                      }
                    }}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700 capitalize">{method}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Session Management */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <Clock className="h-5 w-5 mr-2 text-gray-600" />
            Session Management
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Session Duration (hours)
              </label>
              <input
                type="number"
                min="1"
                max="168"
                value={securitySettings.sessionSettings.maxSessionDuration}
                onChange={(e) => setSecuritySettings(prev => ({
                  ...prev,
                  sessionSettings: {
                    ...prev.sessionSettings,
                    maxSessionDuration: parseInt(e.target.value)
                  }
                }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Idle Timeout (minutes)
              </label>
              <input
                type="number"
                min="5"
                max="120"
                value={securitySettings.sessionSettings.idleTimeout}
                onChange={(e) => setSecuritySettings(prev => ({
                  ...prev,
                  sessionSettings: {
                    ...prev.sessionSettings,
                    idleTimeout: parseInt(e.target.value)
                  }
                }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Concurrent Sessions
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={securitySettings.sessionSettings.maxConcurrentSessions}
                onChange={(e) => setSecuritySettings(prev => ({
                  ...prev,
                  sessionSettings: {
                    ...prev.sessionSettings,
                    maxConcurrentSessions: parseInt(e.target.value)
                  }
                }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
          </div>
          
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={securitySettings.sessionSettings.requireReauthForSensitive}
              onChange={(e) => setSecuritySettings(prev => ({
                ...prev,
                sessionSettings: {
                  ...prev.sessionSettings,
                  requireReauthForSensitive: e.target.checked
                }
              }))}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">Require re-authentication for sensitive operations</span>
          </label>
        </div>
      </div>

      {/* Security Features */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <Shield className="h-5 w-5 mr-2 text-gray-600" />
            Security Features
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={securitySettings.securityFeatures.rateLimiting}
                onChange={(e) => setSecuritySettings(prev => ({
                  ...prev,
                  securityFeatures: {
                    ...prev.securityFeatures,
                    rateLimiting: e.target.checked
                  }
                }))}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Enable rate limiting</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={securitySettings.securityFeatures.ipWhitelist}
                onChange={(e) => setSecuritySettings(prev => ({
                  ...prev,
                  securityFeatures: {
                    ...prev.securityFeatures,
                    ipWhitelist: e.target.checked
                  }
                }))}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Enable IP whitelist</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={securitySettings.securityFeatures.suspiciousActivityDetection}
                onChange={(e) => setSecuritySettings(prev => ({
                  ...prev,
                  securityFeatures: {
                    ...prev.securityFeatures,
                    suspiciousActivityDetection: e.target.checked
                  }
                }))}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Enable suspicious activity detection</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={securitySettings.securityFeatures.auditLogging}
                onChange={(e) => setSecuritySettings(prev => ({
                  ...prev,
                  securityFeatures: {
                    ...prev.securityFeatures,
                    auditLogging: e.target.checked
                  }
                }))}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Enable comprehensive audit logging</span>
            </label>
          </div>
          
          {securitySettings.securityFeatures.ipWhitelist && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                IP Address Whitelist
              </label>
              <div className="flex space-x-2 mb-3">
                <input
                  type="text"
                  placeholder="Enter IP address"
                  value={newIpAddress}
                  onChange={(e) => setNewIpAddress(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                />
                <button
                  onClick={addWhitelistedIP}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                {whitelistedIPs.map((ip, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                    <span className="text-sm text-gray-700">{ip}</span>
                    <button
                      onClick={() => removeWhitelistedIP(ip)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active Sessions */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <User className="h-5 w-5 mr-2 text-gray-600" />
            Active Sessions
          </h3>
        </div>
        <div className="p-6">
          {activeSessions.length > 0 ? (
            <div className="space-y-3">
              {activeSessions.map((session) => {
                const sessionStatus = getSessionStatus(session);
                return (
                  <div key={session.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className={`p-2 rounded-full ${sessionStatus.bg}`}>
                        <Clock className={`h-4 w-4 ${sessionStatus.color}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {session.userName || session.userId}
                        </p>
                        <p className="text-xs text-gray-500">
                          {session.ipAddress} • {session.userAgent}
                        </p>
                        <p className="text-xs text-gray-500">
                          Last activity: {new Date(session.lastActivity).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${sessionStatus.bg} ${sessionStatus.color}`}>
                        {sessionStatus.status}
                      </span>
                      <button
                        onClick={() => handleTerminateSession(session.id)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Terminate session"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No active sessions found</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SecurityPage; 