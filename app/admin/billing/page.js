"use client";
import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Users, CreditCard, AlertCircle } from 'lucide-react';

export default function AdminBilling() {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      setStats({
        totalRevenue: 1250000,
        activeSubscriptions: 45,
        pendingPayments: 8,
        overdueInvoices: 3
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
          <h1 className="text-2xl font-bold text-gray-900">Billing & Subscriptions</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage system-wide billing, subscriptions, and financial oversight
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
              <p className="text-sm font-medium text-gray-600">Pending Payments</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.pendingPayments || 0}
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
              <p className="text-sm font-medium text-gray-600">Overdue Invoices</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.overdueInvoices || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Billing Overview</h2>
        <p className="text-gray-600">
          This page provides comprehensive billing and subscription management for the InsightBooks platform.
          Monitor revenue, manage subscriptions, and oversee financial operations across all tenants.
        </p>
        
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">Recent Activity</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div>• New subscription activated - Acme Corp</div>
              <div>• Payment received - Global Innovations</div>
              <div>• Subscription renewed - Tech Solutions</div>
            </div>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">Quick Actions</h3>
            <div className="space-y-2">
              <a href="/admin/billing/subscriptions" className="block w-full text-left text-sm text-indigo-600 hover:text-indigo-800">
                • Manage Subscriptions
              </a>
              <button className="w-full text-left text-sm text-indigo-600 hover:text-indigo-800">
                • Generate revenue report
              </button>
              <button className="w-full text-left text-sm text-indigo-600 hover:text-indigo-800">
                • Manage payment methods
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}