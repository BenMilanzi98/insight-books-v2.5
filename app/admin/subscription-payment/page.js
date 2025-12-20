"use client";

import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  DollarSign, 
  CheckCircle, 
  AlertCircle,
  Search,
  Filter,
  Eye
} from 'lucide-react';

export default function SubscriptionPaymentPage() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSubscription, setSelectedSubscription] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amount: '',
    currency: 'MWK',
    paymentMethod: 'bank',
    txRef: '',
    status: 'completed'
  });

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/subscriptions');
      
      if (response.ok) {
        const data = await response.json();
        setSubscriptions(data.subscriptions || []);
      } else {
        setError('Failed to fetch subscriptions');
      }
    } catch (error) {
      setError('Network error');
      console.error('Fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/subscription/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: selectedSubscription.id,
          ...paymentData
        }),
      });

      const result = await response.json();

      if (result.success) {
        setShowPaymentModal(false);
        setSelectedSubscription(null);
        setPaymentData({
          amount: '',
          currency: 'MWK',
          paymentMethod: 'bank',
          txRef: '',
          status: 'completed'
        });
        
        // Refresh subscriptions
        fetchSubscriptions();
        
        // Show success message
        alert(`Payment processed successfully! ${result.data.commissionCalculated ? 'Commission calculated and assigned to affiliate.' : ''}`);
      } else {
        alert(`Payment failed: ${result.error}`);
      }
    } catch (error) {
      alert('Network error. Please try again.');
      console.error('Payment error:', error);
    }
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      'Pending': 'bg-yellow-100 text-yellow-800',
      'Active': 'bg-green-100 text-green-800',
      'Failed': 'bg-red-100 text-red-800',
      'Cancelled': 'bg-gray-100 text-gray-800'
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  const getTrialBadge = (isTrial) => {
    return isTrial 
      ? 'bg-blue-100 text-blue-800' 
      : 'bg-gray-100 text-gray-800';
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
          <h1 className="text-2xl font-bold text-gray-900">Subscription Payment Processing</h1>
          <p className="text-sm text-gray-500">Process subscription payments and calculate affiliate commissions</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">Total Subscriptions</p>
            <p className="text-2xl font-bold text-gray-900">{subscriptions.length}</p>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">Pending Payment</p>
            <p className="text-2xl font-bold text-yellow-600">
              {subscriptions.filter(s => s.status === 'Pending').length}
            </p>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">Active Subscriptions</p>
            <p className="text-2xl font-bold text-green-600">
              {subscriptions.filter(s => s.status === 'Active').length}
            </p>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">Trial Users</p>
            <p className="text-2xl font-bold text-blue-600">
              {subscriptions.filter(s => s.isTrial).length}
            </p>
          </div>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Subscriptions</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trial
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {subscriptions.length > 0 ? (
                subscriptions.map((subscription) => (
                  <tr key={subscription.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {subscription.tenant?.name || 'Unknown'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {subscription.tenant?.subdomain || 'No subdomain'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {(() => {
                          const plan = subscription.plan;
                          if (plan === '1year') return '1 Year Plan';
                          if (plan === '3months') return '3 Months Plan';
                          if (plan === '1month') return '1 Month Plan';
                          return plan;
                        })()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(subscription.status)}`}>
                        {subscription.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTrialBadge(subscription.isTrial)}`}>
                        {subscription.isTrial ? 'Trial' : 'Paid'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        MWK {(subscription.amount || 0).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => {
                          setSelectedSubscription(subscription);
                          setPaymentData({
                            amount: subscription.amount?.toString() || '150000',
                            currency: subscription.currency || 'MWK',
                            paymentMethod: 'bank',
                            txRef: `PAY_${subscription.id}_${Date.now()}`,
                            status: 'completed'
                          });
                          setShowPaymentModal(true);
                        }}
                        className="text-indigo-600 hover:text-indigo-900 p-2"
                        title="Process payment"
                      >
                        <CreditCard className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                    No subscriptions found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedSubscription && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Process Payment</h3>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <AlertCircle className="h-6 w-6" />
                </button>
              </div>
              
              <form onSubmit={handlePaymentSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tenant
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={selectedSubscription.tenant?.name || 'Unknown'}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount (MWK) *
                  </label>
                  <input
                    type="number"
                    required
                    value={paymentData.amount}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="150000"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentData.paymentMethod}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="bank">Bank Transfer</option>
                    <option value="mobile_money">Mobile Money</option>
                    <option value="card">Credit/Debit Card</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Transaction Reference *
                  </label>
                  <input
                    type="text"
                    required
                    value={paymentData.txRef}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, txRef: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="PAY_123456"
                  />
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    Process Payment
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 