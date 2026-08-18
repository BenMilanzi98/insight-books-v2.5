"use client";
import { tt } from '@/lib/i18n/runtime';
import { useState, useEffect } from 'react';
import {
  FileText, CheckCircle, XCircle, Clock, AlertCircle,
  RefreshCw, Settings, ArrowRight, Wifi, WifiOff, TrendingUp
} from 'lucide-react';
import Link from 'next/link';
import StatCard from '@/components/ui/StatCard';

export default function EISDashboardPage() {
  const [data, setData] = useState(null);
  const [health, setHealth] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    setIsLoading(true);
    try {
      const [dashRes, healthRes] = await Promise.all([
        fetch('/api/eis/dashboard'),
        fetch('/api/eis/health').catch(() => null)
      ]);

      if (dashRes.ok) {
        const d = await dashRes.json();
        setData(d.data);
      }
      if (healthRes?.ok) {
        setHealth(await healthRes.json());
      } else if (healthRes) {
        setHealth(await healthRes.json().catch(() => ({ mraConnected: false })));
      }
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{tt('MRA EIS Dashboard')}</h1>
          <p className="text-gray-500 mt-1">{tt('Electronic Invoice System integration overview')}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            health?.mraConnected
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {health?.mraConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {health?.mraConnected ? tt('MRA Connected') : tt('MRA Disconnected')}
            {health?.latency && <span className="text-xs opacity-70">({health.latency})</span>}
          </div>
          <button onClick={loadDashboard} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </div>

      {!data?.configuration && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-amber-800">{tt('EIS Not Configured')}</h3>
              <p className="text-sm text-amber-700 mt-0.5">
                {tt('Configure your MRA API credentials to start submitting electronic invoices.')}
              </p>
              <Link href="/eis/config" className="inline-flex items-center gap-1 text-sm font-medium text-amber-800 hover:text-amber-900 mt-2">
                {tt('Configure Now')} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total Submitted" value={data?.totalInvoices || 0} icon={FileText} barClassName="from-blue-400 via-indigo-500 to-blue-600" iconWrapClassName="bg-blue-50 text-blue-600" />
        <StatCard label="Approved" value={data?.approved || 0} icon={CheckCircle} barClassName="from-emerald-400 via-green-500 to-teal-500" iconWrapClassName="bg-green-50 text-green-600" />
        <StatCard label="Pending" value={(data?.pending || 0) + (data?.submitted || 0)} icon={Clock} barClassName="from-amber-400 via-yellow-500 to-orange-500" iconWrapClassName="bg-yellow-50 text-yellow-600" />
        <StatCard label="Rejected" value={data?.rejected || 0} icon={XCircle} barClassName="from-red-400 via-rose-500 to-pink-500" iconWrapClassName="bg-red-50 text-red-600" />
        <StatCard label="Success Rate" value={`${data?.successRate || 0}%`} icon={TrendingUp} barClassName="from-blue-400 via-sky-500 to-indigo-500" iconWrapClassName="bg-blue-50 text-blue-600" />
      </div>

      {data?.monthlyUsage && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{tt('Current Month Usage')}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{data.monthlyUsage.invoiceCount}</p>
              <p className="text-xs text-gray-500">{tt('Invoices')}</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{data.monthlyUsage.approvedCount}</p>
              <p className="text-xs text-gray-500">{tt('Approved')}</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{data.monthlyUsage.rejectedCount}</p>
              <p className="text-xs text-gray-500">{tt('Rejected')}</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">MK {(data.monthlyUsage.totalAmount || 0).toLocaleString()}</p>
              <p className="text-xs text-gray-500">{tt('Total Amount')}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{tt('Recent Submissions')}</h2>
          <Link href="/eis/invoices" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
            {tt('View All')} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {(!data?.recentInvoices || data.recentInvoices.length === 0) ? (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">{tt('No submissions yet')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{tt('Invoice #')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{tt('Date')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{tt('Amount')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{tt('MRA ID')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{tt('Status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.recentInvoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{inv.invoiceNumber}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{new Date(inv.invoiceDate).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">MK {(inv.totalAmount || 0).toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{inv.mraInvoiceId || '-'}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={inv.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex gap-4">
        <Link href="/eis/config" className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm">
          <Settings className="h-4 w-4" /> {tt('EIS Configuration')}
        </Link>
        <Link href="/eis/invoices" className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm">
          <FileText className="h-4 w-4" /> {tt('All Invoices')}
        </Link>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    Approved: 'bg-green-100 text-green-800',
    Rejected: 'bg-red-100 text-red-800',
    Submitted: 'bg-blue-100 text-blue-800',
    Pending: 'bg-yellow-100 text-yellow-800',
    Error: 'bg-red-100 text-red-800'
  };
  return (
    <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}
