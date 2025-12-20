"use client";
import { useState, useEffect } from 'react';
import { 
  CreditCard, 
  DollarSign, 
  CheckCircle, 
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  TrendingUp
} from 'lucide-react';

export default function AdminPayments() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
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
          <h1 className="text-2xl font-bold text-gray-900">Payment Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor payment processing, track transaction status, and manage payment methods
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">Total Payments</p>
            <p className="text-2xl font-bold text-gray-900">89</p>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">Successful</p>
            <p className="text-2xl font-bold text-green-600">82</p>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">5</p>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">Failed</p>
            <p className="text-2xl font-bold text-red-600">2</p>
          </div>
        </div>
      </div>

      {/* Payment Methods Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CreditCard className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Bank Transfer</p>
              <p className="text-2xl font-bold text-gray-900">45</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CreditCard className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Mobile Money</p>
              <p className="text-2xl font-bold text-gray-900">28</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <CreditCard className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Card Payments</p>
              <p className="text-2xl font-bold text-gray-900">16</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search payments by tenant, transaction reference, or amount..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select className="px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500">
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
            <select className="px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500">
              <option value="all">All Methods</option>
              <option value="bank">Bank Transfer</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="card">Card</option>
            </select>
            <button className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Payments</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transaction
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  PAY_123456789
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">Acme Corp</div>
                  <div className="text-sm text-gray-500">acme.insightbooks.com</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  MWK 30,000
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  Bank Transfer
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Completed
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  2024-01-15
                </td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  PAY_987654321
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">Global Innovations</div>
                  <div className="text-sm text-gray-500">global.insightbooks.com</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  MWK 80,000
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  Mobile Money
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Pending
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  2024-01-16
                </td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  PAY_456789123
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">Tech Solutions</div>
                  <div className="text-sm text-gray-500">tech.insightbooks.com</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  MWK 300,000
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  Card Payment
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Completed
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  2024-01-14
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Processing Link */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-indigo-800 mb-2">Process New Payments</h3>
            <p className="text-indigo-700">
              Need to process a subscription payment or manually record a payment? 
              Use our payment processing system.
            </p>
          </div>
          <a
            href="/admin/subscription-payment"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Process Payments
          </a>
        </div>
      </div>

      {/* Coming Soon Message */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-6 text-center">
        <CreditCard className="mx-auto h-12 w-12 text-blue-400 mb-4" />
        <h3 className="text-lg font-medium text-blue-800 mb-2">Enhanced Payment Management Coming Soon</h3>
        <p className="text-blue-700">
          Advanced payment management features are being developed. This will include payment gateway integration, 
          automated reconciliation, and comprehensive payment analytics.
        </p>
      </div>
    </div>
  );
}
