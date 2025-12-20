"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, Mail, AlertCircle, CheckCircle } from 'lucide-react';

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    // Check if admin is already logged in
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/admin/auth/me');
        if (response.ok) {
          router.push('/admin/dashboard');
        }
      } catch (error) {
        // Not authenticated, stay on login page
      }
    };
    
    checkAuth();
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Login successful! Redirecting...');
        setTimeout(() => {
          router.push('/admin/dashboard');
        }, 1000);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
      
      {/* Branding Section */}
      <div className="hidden md:flex md:w-1/2 bg-indigo-900 text-white p-8 flex-col justify-between">
        <div>
          <div className="flex items-center mb-8">
            <div className="h-12 w-12 rounded-lg bg-white text-indigo-900 flex items-center justify-center font-bold text-2xl mr-4">
              IB
            </div>
            <h1 className="text-3xl font-bold">InsightBooks</h1>
          </div>
          <div className="max-w-md mt-8">
            <h2 className="text-4xl font-bold mb-6">Admin Portal</h2>
            <p className="text-lg mb-6 text-indigo-100">
              Complete system administration and oversight for the InsightBooks platform.
            </p>
            <div className="space-y-4">
              <div className="flex items-center">
                <div className="h-6 w-6 rounded-full bg-indigo-700 flex items-center justify-center mr-3 text-sm">✓</div>
                <span>System-wide monitoring and analytics</span>
              </div>
              <div className="flex items-center">
                <div className="h-6 w-6 rounded-full bg-indigo-700 flex items-center justify-center mr-3 text-sm">✓</div>
                <span>Tenant and user management</span>
              </div>
              <div className="flex items-center">
                <div className="h-6 w-6 rounded-full bg-indigo-700 flex items-center justify-center mr-3 text-sm">✓</div>
                <span>Financial oversight and reporting</span>
              </div>
              <div className="flex items-center">
                <div className="h-6 w-6 rounded-full bg-indigo-700 flex items-center justify-center mr-3 text-sm">✓</div>
                <span>Security and audit logging</span>
              </div>
            </div>
          </div>
        </div>
        <div className="text-sm opacity-80">
          © InsightBooks - Enterprise Administration
        </div>
      </div>

      {/* Login Form Section */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 md:hidden">
            <div className="flex items-center justify-center mb-4">
              <div className="h-10 w-10 rounded-lg bg-indigo-900 text-white flex items-center justify-center font-bold text-xl mr-3">
                IB
              </div>
              <h1 className="text-2xl font-bold text-gray-900">InsightBooks</h1>
            </div>
            <h2 className="text-xl font-semibold text-gray-700">Admin Portal</h2>
          </div>

          <div className="bg-white rounded-lg shadow-xl p-8 border border-gray-200">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin Login</h2>
              <p className="text-gray-600">Access the system administration panel</p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <span className="text-red-700 text-sm">{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                <span className="text-green-700 text-sm">{success}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Admin Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="admin@insightbooks.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-900 hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  'Sign In to Admin Portal'
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500">
                Default credentials: admin@insightbooks.com / admin123
              </p>
              <p className="text-xs text-gray-500 mt-1">
                ⚠️ Change password after first login
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 