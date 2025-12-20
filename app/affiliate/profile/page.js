"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  User,
  Mail,
  Building,
  CreditCard,
  Save,
  Edit,
  X,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

export default function AffiliateProfilePage() {
  const router = useRouter();
  const [affiliate, setAffiliate] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    businessName: '',
    paymentMethod: '',
    paymentDetails: {}
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/affiliate/profile');
      if (response.ok) {
        const data = await response.json();
        setAffiliate(data.affiliate);
        setFormData({
          name: data.affiliate.name || '',
          email: data.affiliate.email || '',
          businessName: data.affiliate.businessName || '',
          paymentMethod: data.affiliate.paymentMethod || 'bank',
          paymentDetails: data.affiliate.paymentDetails ? JSON.parse(data.affiliate.paymentDetails) : {}
        });
      } else {
        setError('Failed to fetch profile');
      }
    } catch (error) {
      setError('Failed to fetch profile');
      console.error('Profile fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePaymentDetailsChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      paymentDetails: {
        ...prev.paymentDetails,
        [name]: value
      }
    }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError('');
      setSuccess('');

      const response = await fetch('/api/affiliate/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSuccess('Profile updated successfully');
        setIsEditing(false);
        fetchProfile(); // Refresh profile data
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to update profile');
      }
    } catch (error) {
      setError('Failed to update profile');
      console.error('Profile update error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({
      name: affiliate.name || '',
      email: affiliate.email || '',
      businessName: affiliate.businessName || '',
      paymentMethod: affiliate.paymentMethod || 'bank',
      paymentDetails: affiliate.paymentDetails ? JSON.parse(affiliate.paymentDetails) : {}
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!affiliate) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Profile Not Found</h1>
          <p className="text-gray-600 mb-6">Unable to load your profile information.</p>
          <button
            onClick={() => router.push('/affiliate/dashboard')}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                <User className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="ml-3">
                <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
                <p className="text-sm text-gray-500">Manage your affiliate profile</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/affiliate/dashboard')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Information */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Profile Information</h2>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </button>
              ) : (
                <div className="flex space-x-2">
                  <button
                    onClick={handleCancel}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-6">
            {/* Error and Success Messages */}
            {error && (
              <div className="mb-6 rounded-md bg-red-50 p-4">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error</h3>
                    <div className="mt-2 text-sm text-red-700">{error}</div>
                  </div>
                </div>
              </div>
            )}

            {success && (
              <div className="mb-6 rounded-md bg-green-50 p-4">
                <div className="flex">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">Success</h3>
                    <div className="mt-2 text-sm text-green-700">{success}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Personal Information</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Full Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  ) : (
                    <p className="mt-1 text-sm text-gray-900">{affiliate.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Email Address</label>
                  <p className="mt-1 text-sm text-gray-900">{affiliate.email}</p>
                  <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Business Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="businessName"
                      value={formData.businessName}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  ) : (
                    <p className="mt-1 text-sm text-gray-900">{affiliate.businessName}</p>
                  )}
                </div>
              </div>

              {/* Affiliate Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Affiliate Information</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Referral Code</label>
                  <p className="mt-1 text-sm font-mono text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                    {affiliate.referralCode}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Commission Rate</label>
                  <p className="mt-1 text-sm text-gray-900">{affiliate.commissionRate}%</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    affiliate.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {affiliate.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Information */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Payment Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Payment Method</label>
                  {isEditing ? (
                    <select
                      name="paymentMethod"
                      value={formData.paymentMethod}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="bank">Bank Transfer</option>
                      <option value="mobile_money">Mobile Money</option>
                      <option value="paypal">PayPal</option>
                    </select>
                  ) : (
                    <p className="mt-1 text-sm text-gray-900 capitalize">{affiliate.paymentMethod}</p>
                  )}
                </div>

                {formData.paymentMethod === 'bank' && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-700">Bank Details</h4>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-600">Account Holder Name</label>
                      {isEditing ? (
                        <input
                          type="text"
                          name="accountName"
                          value={formData.paymentDetails.accountName || ''}
                          onChange={handlePaymentDetailsChange}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      ) : (
                        <p className="mt-1 text-sm text-gray-900">
                          {formData.paymentDetails.accountName || 'Not provided'}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600">Account Number</label>
                      {isEditing ? (
                        <input
                          type="text"
                          name="accountNumber"
                          value={formData.paymentDetails.accountNumber || ''}
                          onChange={handlePaymentDetailsChange}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      ) : (
                        <p className="mt-1 text-sm text-gray-900">
                          {formData.paymentDetails.accountNumber || 'Not provided'}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600">Bank Name</label>
                      {isEditing ? (
                        <input
                          type="text"
                          name="bankName"
                          value={formData.paymentDetails.bankName || ''}
                          onChange={handlePaymentDetailsChange}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      ) : (
                        <p className="mt-1 text-sm text-gray-900">
                          {formData.paymentDetails.bankName || 'Not provided'}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 