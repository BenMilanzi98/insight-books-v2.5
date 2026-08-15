"use client";
import { tt } from '@/lib/i18n/runtime';

import React, { useState, useEffect } from "react";
import { 
  CheckCircle,
  XCircle,
  Clock,
  User,
  DollarSign,
  ArrowRight,
  ExternalLink
} from "lucide-react";

const ReferralPage = ({ params }) => {
  const [affiliate, setAffiliate] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [referralTracked, setReferralTracked] = useState(false);

  useEffect(() => {
    if (params.code) {
      trackReferral(params.code);
    }
  }, [params.code]);

  const trackReferral = async (referralCode) => {
    try {
      setIsLoading(true);
      
      // First, verify the affiliate exists
      const affiliateResponse = await fetch(`/api/affiliate/verify/${referralCode}`);
      if (affiliateResponse.ok) {
        const affiliateData = await affiliateResponse.json();
        setAffiliate(affiliateData.affiliate);
        
        // Track the referral click
        const trackResponse = await fetch('/api/affiliate/track', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            referralCode: referralCode,
            userAgent: navigator.userAgent,
            referrer: document.referrer,
            timestamp: new Date().toISOString()
          }),
        });

        if (trackResponse.ok) {
          setReferralTracked(true);
        }
      } else {
        setError('Invalid referral link');
      }
    } catch (error) {
      setError('Failed to process referral');
      console.error('Referral tracking error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const continueToRegistration = () => {
    // Redirect to the existing signup page with referral code pre-filled
    window.location.href = `/auth/signup?ref=${params.code}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{tt('Processing your referral...')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{tt('Invalid Referral Link')}</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.href = '/auth/signup'}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            {tt('Continue to Signup')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Success Message */}
        <div className="text-center mb-12">
          <div className="mx-auto h-24 w-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {tt('Welcome to Insight Books!')}
          </h1>

        </div>



        {/* CTA Section */}
        <div className="text-center">
          <div className="bg-gradient-to-r from-blue-600 to-sky-600 rounded-lg p-8 text-white">
            <h2 className="text-2xl font-bold mb-4">
              Ready to try Insight Books for free?
            </h2>
            <p className="text-indigo-100 mb-6 max-w-2xl mx-auto">
              Join thousands of users who are already managing their business with Insight Books. 
              Your referral has been tracked and you're all set to begin!
            </p>
            <button
              onClick={continueToRegistration}
              className="inline-flex items-center px-8 py-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-indigo-600 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white transition-colors"
            >
              {tt('Create Your Account')}
              <ArrowRight className="ml-2 h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            {tt('Your referral has been successfully tracked. Thank you for using our affiliate program!')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReferralPage; 