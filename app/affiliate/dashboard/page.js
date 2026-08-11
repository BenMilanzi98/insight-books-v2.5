"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  DollarSign,
  Users,
  TrendingUp,
  BarChart3,
  LogOut,
  Copy,
  ExternalLink,
  Eye,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  User
} from 'lucide-react';

export default function AffiliateDashboard() {
  const router = useRouter();
  const [affiliate, setAffiliate] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [stats, setStats] = useState({
    totalReferrals: 0,
    completedReferrals: 0,
    pendingReferrals: 0,
    totalCommissions: 0,
    pendingPayouts: 0,
    monthlyCommissions: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showReferrals, setShowReferrals] = useState(false);

  useEffect(() => {
    fetchAffiliateData();
  }, []);

  const fetchAffiliateData = async () => {
    try {
      setIsLoading(true);
      const [affiliateResponse, referralsResponse, statsResponse] = await Promise.all([
        fetch('/api/affiliate/profile'),
        fetch('/api/affiliate/referrals'),
        fetch('/api/affiliate/dashboard-stats')
      ]);

      if (affiliateResponse.ok) {
        const affiliateData = await affiliateResponse.json();
        setAffiliate(affiliateData.affiliate);
      }

      if (referralsResponse.ok) {
        const referralsData = await referralsResponse.json();
        setReferrals(referralsData.referrals || []);
      }

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.stats || stats);
      }
    } catch (error) {
      setError('Failed to fetch affiliate data');
      console.error('Affiliate fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    // Clear affiliate session and redirect to login
    fetch('/api/affiliate/logout', { method: 'POST' });
    router.push('/affiliate/login');
  };

  const copyReferralLink = () => {
    const link = `${window.location.origin}/ref/${affiliate?.referralCode}`;
    navigator.clipboard.writeText(link);
    // You could add a toast notification here
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'completed': 'bg-green-100 text-green-800',
      'failed': 'bg-red-100 text-red-800'
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background-secondary)]">
        <div className="text-center">
          <div
            className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--action-primary)]"
            role="status"
            aria-label="Loading"
          />
          <p className="text-[var(--text-secondary)]">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background-secondary)]">
      <div className="bg-[var(--surface-primary)] shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4 py-6">
            <div className="flex min-w-0 items-center">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--action-primary)]/10">
                <Users className="h-6 w-6 text-[var(--action-primary)]" aria-hidden="true" />
              </div>
              <div className="ml-3 min-w-0">
                <h1 className="truncate text-2xl font-bold text-[var(--text-primary)]">Affiliate Dashboard</h1>
                <p className="truncate text-sm text-[var(--text-muted)]">Welcome back, {affiliate?.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/affiliate/profile')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <User className="h-4 w-4 mr-2" />
                Profile
              </button>
              <button
                onClick={copyReferralLink}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Link
              </button>
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Referrals</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalReferrals}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-green-600">{stats.completedReferrals}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Commissions</p>
                <p className="min-w-0 break-words text-xl font-bold leading-tight tabular-nums text-purple-600 sm:text-2xl">MWK {stats.totalCommissions.toLocaleString()}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending Payouts</p>
                <p className="min-w-0 break-words text-xl font-bold leading-tight tabular-nums text-yellow-600 sm:text-2xl">MWK {stats.pendingPayouts.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Referral Link Section */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Your Referral Link</h2>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/ref/${affiliate?.referralCode}`}
                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-sm"
              />
            </div>
            <button
              onClick={copyReferralLink}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </button>
            <button
              onClick={() => window.open(`/ref/${affiliate?.referralCode}`, '_blank')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Preview
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Share this link with potential customers to earn commissions on their subscriptions.
          </p>
        </div>

        {/* Referrals Section */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Your Referrals</h3>
              <button
                onClick={() => setShowReferrals(!showReferrals)}
                className="text-sm text-indigo-600 hover:text-indigo-900"
              >
                {showReferrals ? 'Hide Details' : 'Show Details'}
              </button>
            </div>
          </div>
          
          {showReferrals && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tenant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Commission
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {referrals.length > 0 ? (
                    referrals.map((referral) => (
                      <tr key={referral.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {referral.tenant?.name || 'Unknown'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {referral.tenant?.subdomain || 'No subdomain'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(referral.status)}`}>
                            {referral.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            MWK {(referral.commissionAmount || 0).toLocaleString()}
                          </div>
                          {referral.status === 'pending' && (
                            <div className="text-xs text-gray-500">Pending payment</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(referral.registrationTimestamp).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                        No referrals yet. Start sharing your referral link to earn commissions!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Commission Information */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 mt-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Commission Structure</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">How It Works</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  Share your referral link with potential customers
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  When they register using your link, you get credit
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  Earn 20% commission on their first subscription payment
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  Commissions are paid out monthly
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Commission Rates</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-indigo-600">20%</div>
                  <div className="text-sm text-gray-600">Commission Rate</div>
                  <div className="text-xs text-gray-500 mt-1">On first subscription payment</div>
                </div>
                <div className="mt-4 text-center">
                  <div className="text-sm text-gray-600">
                    <strong>Example:</strong> When someone subscribes to Pro Plan (MWK 399,000), 
                    you earn <span className="font-semibold text-indigo-600">MWK 79,800</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mt-8">
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
    </div>
  );
} 