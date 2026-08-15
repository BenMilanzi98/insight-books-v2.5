"use client";
import { tt } from '@/lib/i18n/runtime';
import { useState, useEffect } from 'react';
import { Clock, Crown, X, AlertCircle, ArrowRight } from 'lucide-react';

const TrialCountdown = ({ subscriptionData, onUpgrade, onDismiss, className = "" }) => {
  const [dismissed, setDismissed] = useState(false);
  const [remainingDays, setRemainingDays] = useState(0);
  const [countdownMessage, setCountdownMessage] = useState("");

  useEffect(() => {
    if (subscriptionData) {
      const days = subscriptionData.remainingTrialDays || 0;
      const message = subscriptionData.subscriptionStatus?.message || "";
      setRemainingDays(days);
      setCountdownMessage(message);
    }
  }, [subscriptionData]);

  // Don't show if no subscription data or trial is not active
  if (!subscriptionData || !subscriptionData.isTrialActive || dismissed) {
    return null;
  }

  const trialExpired = remainingDays === 0;
  const urgentTrial = remainingDays <= 1;

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      // Default upgrade action - redirect to subscription/payment page
      window.location.href = '/subscription';
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    if (onDismiss) {
      onDismiss();
    }
  };

  if (trialExpired) {
    return (
      <div className={`relative bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-6 ${className}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-red-800 mb-2">
                {tt('Free Trial Ended')}
              </h3>
              <p className="text-red-700 mb-4">
                {tt('Your 3-day free trial has ended. Upgrade to a paid plan to continue using all features and avoid losing access to your data.')}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleUpgrade}
                  className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white font-medium rounded-lg hover:from-red-700 hover:to-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <Crown className="h-5 w-5 mr-2" />
                  {tt('Upgrade Now - Save Your Data')}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </button>
                <button
                  onClick={() => window.location.href = '/subscription'}
                  className="inline-flex items-center justify-center px-6 py-3 bg-white text-red-600 font-medium rounded-lg border border-red-300 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200"
                >
                  {tt('View All Plans')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${urgentTrial ? 'bg-gradient-to-r from-orange-50 to-red-50 border-orange-200' : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'} border rounded-xl p-6 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <Clock className={`h-8 w-8 ${urgentTrial ? 'text-orange-500' : 'text-blue-500'}`} />
          </div>
          <div className="flex-1">
            <h3 className={`text-xl font-semibold ${urgentTrial ? 'text-orange-800' : 'text-blue-800'} mb-2`}>
              Free Trial: {countdownMessage}
            </h3>
            <p className={`${urgentTrial ? 'text-orange-700' : 'text-blue-700'} mb-4`}>
              {urgentTrial 
                ? "Your trial is ending soon! Upgrade now to avoid losing access to your data and unlock premium features."
                : "You're currently on a free trial. Upgrade anytime to unlock premium features and ensure uninterrupted access."
              }
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleUpgrade}
                className={`inline-flex items-center justify-center px-6 py-3 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl ${
                  urgentTrial 
                    ? 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 focus:ring-orange-500' 
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:ring-blue-500'
                }`}
              >
                <Crown className="h-5 w-5 mr-2" />
                {urgentTrial ? 'Upgrade Now - Don\'t Lose Access' : 'Upgrade to Premium'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </button>
              <button
                onClick={() => window.location.href = '/subscription'}
                className={`inline-flex items-center justify-center px-6 py-3 bg-white font-medium rounded-lg border focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 ${
                  urgentTrial 
                    ? 'text-orange-600 border-orange-300 hover:bg-orange-50 focus:ring-orange-500' 
                    : 'text-blue-600 border-blue-300 hover:bg-blue-50 focus:ring-blue-500'
                }`}
              >
                {tt('View All Plans')}
              </button>
            </div>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className={`flex-shrink-0 p-2 rounded-lg hover:bg-white hover:bg-opacity-50 transition-colors ${
            urgentTrial ? 'text-orange-500 hover:text-orange-700' : 'text-blue-500 hover:text-blue-700'
          }`}
          title="Dismiss notification"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default TrialCountdown; 