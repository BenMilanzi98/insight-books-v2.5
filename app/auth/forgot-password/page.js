"use client";
import { tt } from '@/lib/i18n/runtime';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Mail, 
  ArrowLeft,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [tenantChoices, setTenantChoices] = useState([]);
  const [showSubdomainHint, setShowSubdomainHint] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          ...(subdomain.trim() ? { subdomain: subdomain.trim() } : {}),
        }),
      });

      const data = await response.json();

      if (response.status === 409 && data.code === 'MULTI_TENANT_EMAIL') {
        setTenantChoices(Array.isArray(data.tenants) ? data.tenants : []);
        setShowSubdomainHint(true);
        setError(data.error || 'Enter your company subdomain and try again.');
        return;
      }

      if (data.success) {
        setSuccess(data.message);
        setEmail(''); // Clear email field
        setSubdomain('');
        setShowSubdomainHint(false);
        setTenantChoices([]);
      } else {
        setError(data.error || 'Failed to send reset email');
      }
    } catch (error) {
      setError('Network error. Please try again.');
      console.error('Password reset request error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
            <Mail className="h-8 w-8 text-indigo-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">{tt('Forgot Password')}</h2>
          <p className="mt-2 text-sm text-gray-600">
            {tt("Enter your email address and we'll send you a link to reset your password")}
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                {tt('Email Address')}
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder={tt('Enter your email address')}
                />
              </div>
            </div>

            {showSubdomainHint && (
              <div>
                <label htmlFor="subdomain" className="block text-sm font-medium text-gray-700">
                  {tt('Company subdomain')}
                </label>
                <p className="mt-1 text-xs text-gray-500 mb-1">
                  From your sign-up link (the part before .insightbooksafrica.com or your custom host).
                </p>
                <input
                  id="subdomain"
                  name="subdomain"
                  type="text"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder={tt('e.g. acmecorp')}
                />
                {tenantChoices.length > 0 && (
                  <ul className="mt-2 text-xs text-gray-600 space-y-1">
                    {tenantChoices.map((t) => (
                      <li key={t.id}>
                        <span className="font-medium text-gray-800">{t.name || 'Business'}</span>
                        {t.subdomain ? (
                          <span> — subdomain: {t.subdomain}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Error and Success Messages */}
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">{tt('Error')}</h3>
                    <div className="mt-2 text-sm text-red-700">{error}</div>
                  </div>
                </div>
              </div>
            )}

            {success && (
              <div className="rounded-md bg-green-50 p-4">
                <div className="flex">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">{tt('Success')}</h3>
                    <div className="mt-2 text-sm text-green-700">{success}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </div>

            {/* Back to Login */}
            <div className="text-center">
              <Link 
                href="/auth/login" 
                className="text-sm text-indigo-600 hover:text-indigo-500 flex items-center justify-center"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                {tt('Back to Login')}
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
