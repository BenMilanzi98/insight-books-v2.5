"use client";

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  Building, 
  Mail, 
  Phone, 
  MapPin, 
  Globe,
  CheckCircle,
  AlertCircle
} from "lucide-react";

const BusinessSetupContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId');
  const tenantId = searchParams.get('tenantId');

  const [formData, setFormData] = useState({
    businessName: "",
    businessEmail: "",
    businessPhone: "",
    personalPhone: "", // Add personal phone field for user
    businessAddress: "",
    businessCity: "",
    website: "",
    industry: "",
    description: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Check if we have the required parameters
  useEffect(() => {
    if (!userId || !tenantId) {
      setError("Invalid setup link. Please sign up again.");
    } else {
      // Fetch current tenant info to pre-fill business name
      fetchCurrentTenantInfo();
    }
  }, [userId, tenantId]);

  const fetchCurrentTenantInfo = async () => {
    try {
      const response = await fetch(`/api/tenant/info?userId=${userId}&tenantId=${tenantId}`);
      if (response.ok) {
        const data = await response.json();
        // Don't pre-fill business name - let user enter it
        // setFormData(prev => ({
        //   ...prev,
        //   businessName: data.tenant.name || ""
        // }));
      }
    } catch (error) {
      console.error('Error fetching tenant info:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // Validate required fields
    if (!formData.businessName || !formData.personalPhone) {
      setError("Business Name and Personal Phone Number are required");
      setIsLoading(false);
      return;
    }

    // Basic phone validation
    const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
    if (!phoneRegex.test(formData.personalPhone.replace(/\s/g, ''))) {
      setError("Please enter a valid phone number");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/business-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          tenantId,
          ...formData
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update business details");
      }

      setSuccess(true);
      
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (error) {
      setError(error.message || "Failed to update business details");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Setup Complete!</h2>
          <p className="text-gray-600 mb-4">
            Your business profile has been updated successfully. Redirecting to dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center">
            <Building className="h-6 w-6 text-indigo-600" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Complete Your Business Setup
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Please provide your business information to complete the setup
          </p>
        </div>

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

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="businessName" className="block text-sm font-medium text-gray-700">
                Business Name *
              </label>
              <input
                id="businessName"
                name="businessName"
                type="text"
                required
                value={formData.businessName}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter your business name"
              />
            </div>

            <div>
              <label htmlFor="businessEmail" className="block text-sm font-medium text-gray-700">
                Business Email
              </label>
              <div className="mt-1 relative">
                <input
                  id="businessEmail"
                  name="businessEmail"
                  type="email"
                  value={formData.businessEmail}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="business@example.com"
                />
                <Mail className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
            </div>

            <div>
              <label htmlFor="personalPhone" className="block text-sm font-medium text-gray-700">
                Personal Phone Number *
              </label>
              <div className="mt-1 relative">
                <input
                  id="personalPhone"
                  name="personalPhone"
                  type="tel"
                  required
                  value={formData.personalPhone}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="+265 123 456 789"
                />
                <Phone className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
              <p className="mt-1 text-xs text-gray-500">Required for account verification</p>
            </div>

            <div>
              <label htmlFor="businessPhone" className="block text-sm font-medium text-gray-700">
                Business Phone
              </label>
              <div className="mt-1 relative">
                <input
                  id="businessPhone"
                  name="businessPhone"
                  type="tel"
                  value={formData.businessPhone}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="+265 123 456 789"
                />
                <Phone className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
            </div>

            <div>
              <label htmlFor="businessAddress" className="block text-sm font-medium text-gray-700">
                Business Address
              </label>
              <div className="mt-1 relative">
                <input
                  id="businessAddress"
                  name="businessAddress"
                  type="text"
                  value={formData.businessAddress}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="123 Business Street"
                />
                <MapPin className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
            </div>

            <div>
              <label htmlFor="businessCity" className="block text-sm font-medium text-gray-700">
                City
              </label>
              <input
                id="businessCity"
                name="businessCity"
                type="text"
                value={formData.businessCity}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Blantyre"
              />
            </div>

            <div>
              <label htmlFor="website" className="block text-sm font-medium text-gray-700">
                Website
              </label>
              <div className="mt-1 relative">
                <input
                  id="website"
                  name="website"
                  type="url"
                  value={formData.website}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="https://www.yourbusiness.com"
                />
                <Globe className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
            </div>

            <div>
              <label htmlFor="industry" className="block text-sm font-medium text-gray-700">
                Industry
              </label>
              <select
                id="industry"
                name="industry"
                value={formData.industry}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Select an industry</option>
                <option value="retail">Retail</option>
                <option value="manufacturing">Manufacturing</option>
                <option value="services">Services</option>
                <option value="technology">Technology</option>
                <option value="healthcare">Healthcare</option>
                <option value="education">Education</option>
                <option value="finance">Finance</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Business Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                value={formData.description}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Brief description of your business..."
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Updating...' : 'Complete Setup'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Main page component with Suspense boundary
export default function BusinessSetupPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BusinessSetupContent />
    </Suspense>
  );
} 