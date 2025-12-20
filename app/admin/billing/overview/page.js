"use client";
import { useState, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  CreditCard, 
  AlertCircle,
  Plus,
  Settings,
  FileText,
  BarChart3
} from 'lucide-react';
import Link from 'next/link';

export default function AdminBillingOverview() {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      setStats({
        totalRevenue: 1250000,
        activeSubscriptions: 45,
        pendingPayments: 8,
        overdueInvoices: 3,
        monthlyRecurringRevenue: 180000,
        trialConversions: 12,
        churnRate: 2.5
      });
      setIsLoading(false);
    }, 1000);
  }, []);

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
          <h1 className="text-2xl font-bold text-gray-900">Billing Overview</h1>
          <p className="mt-1 text-sm text-gray-500">
            Comprehensive overview of system-wide billing, subscriptions, and financial metrics
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                MWK {stats?.totalRevenue?.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Subscriptions</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.activeSubscriptions || 0}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <CreditCard className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-600">Monthly Recurring Revenue</div>
              <p className="text-2xl font-bold text-gray-900">
                MWK {(stats?.monthlyRecurringRevenue || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Churn Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.churnRate || 0}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Subscription Management */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center mb-4">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Plus className="h-6 w-6 text-indigo-600" />
            </div>
            <h3 className="ml-3 text-lg font-medium text-gray-900">Subscription Management</h3>
          </div>
          <p className="text-gray-600 mb-4">
            Create, edit, and manage all system subscriptions. Monitor trial users and subscription status.
          </p>
          <Link
            href="/admin/billing/subscriptions"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Manage Subscriptions
          </Link>
        </div>

        {/* Payment Processing */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <CreditCard className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="ml-3 text-lg font-medium text-gray-900">Payment Processing</h3>
          </div>
          <p className="text-gray-600 mb-4">
            Process subscription payments, calculate affiliate commissions, and manage payment methods.
          </p>
          <Link
            href="/admin/subscription-payment"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
          >
            Process Payments
          </Link>
        </div>

        {/* Analytics & Reports */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <BarChart3 className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="ml-3 text-lg font-medium text-gray-900">Analytics & Reports</h3>
          </div>
          <p className="text-gray-600 mb-4">
            View detailed subscription analytics, growth metrics, and generate financial reports.
          </p>
          <Link
            href="/admin/dashboard/subscription-analytics"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
          >
            View Analytics
          </Link>
        </div>

        {/* Invoice Management */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center mb-4">
            <div className="p-2 bg-orange-100 rounded-lg">
              <FileText className="h-6 w-6 text-orange-600" />
            </div>
            <h3 className="ml-3 text-lg font-medium text-gray-900">Invoice Management</h3>
          </div>
          <p className="text-gray-600 mb-4">
            Generate, manage, and track invoices for all subscriptions and payments.
          </p>
          <Link
            href="/admin/billing/invoices"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700"
          >
            Manage Invoices
          </Link>
        </div>

        {/* Billing Settings */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center mb-4">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Settings className="h-6 w-6 text-gray-600" />
            </div>
            <h3 className="ml-3 text-lg font-medium text-gray-900">Billing Settings</h3>
          </div>
          <p className="text-gray-600 mb-4">
            Configure billing preferences, payment gateways, and subscription plan settings.
          </p>
          <Link
            href="/admin/global-settings"
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Configure Settings
          </Link>
        </div>

        {/* Financial Reports */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center mb-4">
            <div className="p-2 bg-teal-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-teal-600" />
            </div>
            <h3 className="ml-3 text-lg font-medium text-gray-900">Financial Reports</h3>
          </div>
          <p className="text-gray-600 mb-4">
            Generate comprehensive financial reports, revenue analysis, and business insights.
          </p>
          <Link
            href="/admin/reports"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700"
          >
            Generate Reports
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Billing Activity</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
              <span className="text-sm text-gray-600">New subscription activated - Acme Corp</span>
            </div>
            <span className="text-xs text-gray-400">2 hours ago</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
              <span className="text-sm text-gray-600">Payment received - Global Innovations</span>
            </div>
            <span className="text-xs text-gray-400">4 hours ago</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-yellow-400 rounded-full mr-3"></div>
              <span className="text-sm text-gray-600">Subscription renewed - Tech Solutions</span>
            </div>
            <span className="text-xs text-gray-400">1 day ago</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-red-400 rounded-full mr-3"></div>
              <span className="text-sm text-gray-600">Payment failed - Startup Inc</span>
            </div>
            <span className="text-xs text-gray-400">2 days ago</span>
          </div>
        </div>
      </div>
    </div>
  );
}
