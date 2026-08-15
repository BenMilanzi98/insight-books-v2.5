"use client";
import { tt } from '@/lib/i18n/runtime';
import { useState, useEffect } from 'react';
import {
  Settings, Save, Eye, EyeOff, CheckCircle, AlertCircle, Loader2, Shield, Wifi, WifiOff,
  Monitor, Package, RefreshCw, Download, Upload
} from 'lucide-react';

export default function EISConfigPage() {
  const [config, setConfig] = useState({
    clientId: '',
    clientSecret: '',
    apiKey: '',
    environment: 'sandbox',
    isActive: true
  });
  const [showSecrets, setShowSecrets] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [message, setMessage] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [healthStatus, setHealthStatus] = useState(null);

  // Terminal activation state (TC-INV-001)
  const [activationCredentials, setActivationCredentials] = useState({ username: '', password: '', terminalSerialNumber: '' });
  const [isActivating, setIsActivating] = useState(false);
  const [activationResult, setActivationResult] = useState(null);
  const [terminalInfo, setTerminalInfo] = useState(null);

  // Product sync state (TC-INV-002)
  const [isSyncingProducts, setIsSyncingProducts] = useState(false);
  const [productSyncResult, setProductSyncResult] = useState(null);

  // Config sync state (TC-CONF-010)
  const [isSyncingConfig, setIsSyncingConfig] = useState(false);
  const [configSyncResult, setConfigSyncResult] = useState(null);

  useEffect(() => { fetchConfig(); }, []);

  const fetchConfig = async () => {
    setIsFetching(true);
    try {
      const response = await fetch('/api/eis/config');
      if (response.ok) {
        const data = await response.json();
        if (data.config) {
          setConfig({
            clientId: data.config.clientId || '',
            clientSecret: '',
            apiKey: '',
            environment: data.config.environment || 'sandbox',
            isActive: data.config.isActive !== false
          });
          setIsConnected(true);
        }
      }
    } catch (error) {
      console.error('Failed to fetch config:', error);
    } finally {
      setIsFetching(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const payload = { ...config };
      if (!payload.clientSecret) delete payload.clientSecret;
      if (!payload.apiKey) delete payload.apiKey;

      const response = await fetch('/api/eis/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({}));
      if (response.ok) {
        setMessage({ type: 'success', text: 'Configuration saved successfully!' });
        setIsConnected(true);
      } else {
        const text = result?.error
          || (response.status === 401 ? 'You must be signed in to save EIS configuration.'
            : response.status === 403 ? 'You do not have permission to change EIS settings.'
              : `Failed to save configuration (${response.status}). Please try again.`);
        setMessage({ type: 'error', text });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Network or server error. Check your connection and try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async () => {
    setIsLoading(true);
    setHealthStatus(null);
    try {
      const response = await fetch('/api/eis/health');
      const data = await response.json();
      setHealthStatus(data);
      if (response.ok && data.mraConnected) {
        setMessage({ type: 'success', text: `Connection to MRA EIS successful! Latency: ${data.latency}` });
      } else {
        setMessage({ type: 'error', text: `Connection failed: ${data.error || 'MRA API unreachable'}` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Cannot connect to MRA EIS' });
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center">
          <Shield className="h-8 w-8 text-indigo-600 mr-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{tt('MRA EIS Configuration')}</h1>
            <p className="text-gray-600 mt-1">
              {tt('Configure your Malawi Revenue Authority Electronic Invoice System integration')}
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg mb-6 flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Settings className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900">{tt('API Credentials')}</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tt('Client ID')}</label>
              <input
                type="text"
                value={config.clientId}
                onChange={(e) => setConfig({ ...config, clientId: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
                placeholder={tt('Your MRA Client ID')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client Secret {isConnected && <span className="text-xs text-gray-400">(leave blank to keep existing)</span>}
              </label>
              <div className="relative">
                <input
                  type={showSecrets ? 'text' : 'password'}
                  value={config.clientSecret}
                  onChange={(e) => setConfig({ ...config, clientSecret: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pr-10"
                  required={!isConnected}
                  placeholder={isConnected ? '••••••••' : 'Your MRA Client Secret'}
                />
                <button type="button" onClick={() => setShowSecrets(!showSecrets)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showSecrets ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Key (Optional)</label>
              <input
                type={showSecrets ? 'text' : 'password'}
                value={config.apiKey}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder={isConnected ? '••••••••' : 'Optional API Key'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tt('Environment')}</label>
              <select
                value={config.environment}
                onChange={(e) => setConfig({ ...config, environment: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="sandbox">Sandbox (Testing)</option>
                <option value="production">Production (Live)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={config.isActive}
                onChange={(e) => setConfig({ ...config, isActive: e.target.checked })}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="isActive" className="text-sm text-gray-900">{tt('Enable EIS Integration')}</label>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button type="submit" disabled={isLoading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Configuration
          </button>
          <button type="button" onClick={testConnection} disabled={isLoading || !config.clientId}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-gray-700 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
            {healthStatus?.mraConnected ? <Wifi className="h-4 w-4 text-green-600" /> : <WifiOff className="h-4 w-4" />}
            Test Connection
          </button>
        </div>
      </form>

      {isConnected && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-green-800 font-medium text-sm">{tt('EIS Configuration Active')}</span>
          </div>
          <p className="text-green-700 text-sm mt-1">
            {tt('Your MRA EIS integration is configured. Sales and invoices for this tenant will be automatically submitted to MRA.')}
          </p>
        </div>
      )}

      {/* ── Terminal Activation (TC-INV-001) ─────────────────── */}
      {isConnected && (
        <div className="mt-8 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Monitor className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900">{tt('Terminal Activation')}</h2>
          </div>

          {terminalInfo ? (
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-sm font-medium text-green-800">{tt('Terminal Activated')}</p>
              <p className="text-xs text-green-700 mt-1">Terminal ID: {terminalInfo.terminalId || 'N/A'}</p>
              <p className="text-xs text-green-700">Site ID: {terminalInfo.siteId || 'N/A'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">{tt('Register this terminal with MRA EIS to enable transaction processing.')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input type="text" placeholder={tt('Username')} value={activationCredentials.username}
                  onChange={(e) => setActivationCredentials({ ...activationCredentials, username: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                <input type="password" placeholder={tt('Password')} value={activationCredentials.password}
                  onChange={(e) => setActivationCredentials({ ...activationCredentials, password: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                <input type="text" placeholder={tt('Terminal Serial No.')} value={activationCredentials.terminalSerialNumber}
                  onChange={(e) => setActivationCredentials({ ...activationCredentials, terminalSerialNumber: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
              <button
                disabled={isActivating || !activationCredentials.username || !activationCredentials.password}
                onClick={async () => {
                  setIsActivating(true);
                  setActivationResult(null);
                  try {
                    const res = await fetch('/api/eis/activate', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(activationCredentials)
                    });
                    const data = await res.json();
                    if (res.ok) {
                      setActivationResult({ type: 'success', text: 'Terminal activated successfully!' });
                      setTerminalInfo(data.data || data);
                    } else {
                      setActivationResult({ type: 'error', text: data.error || 'Activation failed' });
                    }
                  } catch (err) {
                    setActivationResult({ type: 'error', text: err.message });
                  } finally { setIsActivating(false); }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {isActivating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Monitor className="h-4 w-4" />}
                Activate Terminal
              </button>
              {activationResult && (
                <div className={`p-3 rounded-lg text-sm ${activationResult.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                  {activationResult.text}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Product Sync (TC-INV-002) ────────────────────────── */}
      {isConnected && (
        <div className="mt-6 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-900">{tt('MRA Product Sync')}</h2>
            </div>
            <button
              disabled={isSyncingProducts}
              onClick={async () => {
                setIsSyncingProducts(true);
                setProductSyncResult(null);
                try {
                  const res = await fetch('/api/eis/products');
                  const data = await res.json();
                  if (res.ok) {
                    const count = data.data?.length || 0;
                    setProductSyncResult({ type: 'success', text: `Downloaded ${count} product(s) from MRA` });
                  } else {
                    setProductSyncResult({ type: 'error', text: data.error || 'Product sync failed' });
                  }
                } catch (err) {
                  setProductSyncResult({ type: 'error', text: err.message });
                } finally { setIsSyncingProducts(false); }
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {isSyncingProducts ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Sync Products
            </button>
          </div>
          <p className="text-sm text-gray-600">{tt('Download the product catalog from MRA to ensure your inventory matches the registered products.')}</p>
          {productSyncResult && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${productSyncResult.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              {productSyncResult.text}
            </div>
          )}
        </div>
      )}

      {/* ── Configuration Sync (TC-CONF-010) ─────────────────── */}
      {isConnected && (
        <div className="mt-6 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-900">{tt('Configuration Sync')}</h2>
            </div>
            <button
              disabled={isSyncingConfig}
              onClick={async () => {
                setIsSyncingConfig(true);
                setConfigSyncResult(null);
                try {
                  const res = await fetch('/api/eis/configurations', { method: 'POST' });
                  const data = await res.json();
                  if (res.ok) {
                    setConfigSyncResult({ type: 'success', text: 'Configuration synced with MRA. Tax rates and terminal settings updated.' });
                  } else {
                    setConfigSyncResult({ type: 'error', text: data.error || 'Config sync failed' });
                  }
                } catch (err) {
                  setConfigSyncResult({ type: 'error', text: err.message });
                } finally { setIsSyncingConfig(false); }
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {isSyncingConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sync Config
            </button>
          </div>
          <p className="text-sm text-gray-600">{tt('Download latest global tax rates, taxpayer info, and terminal configuration from MRA portal.')}</p>
          {configSyncResult && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${configSyncResult.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              {configSyncResult.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
