// components/SubscriptionCountdownBanner.js
"use client";
import { tt } from '@/lib/i18n/runtime';

import { useState, useEffect } from 'react';
import { Clock, AlertCircle, Crown, ArrowRight, Sparkles, Zap } from 'lucide-react';
import Link from 'next/link';
import { SUBSCRIPTION_PLANS_ARRAY } from '@/lib/subscriptionConfig';

const SubscriptionCountdownBanner = ({ subscription, isTrialActive, remainingTrialDays, onUpgrade, thresholdDays }) => {
  const [timeRemaining, setTimeRemaining] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isExpired, setIsExpired] = useState(false);
  const [urgencyLevel, setUrgencyLevel] = useState('normal'); // normal, warning, urgent, expired
  const [shouldShow, setShouldShow] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Get countdown threshold based on subscription plan
  const getCountdownThreshold = () => {
    // If thresholdDays prop is provided, use it (allows override for dashboard)
    if (thresholdDays !== undefined && thresholdDays !== null) {
      return thresholdDays;
    }
    
    if (!subscription) return 0;
    
    // Trial: Show all 3 days
    if (subscription.isTrial || isTrialActive) {
      return 3; // Show for all 3 days
    }
    
    // Get plan from subscription
    const plan = subscription.plan || '';
    
    // Determine threshold based on plan type
    if (plan === '1month' || plan === '1_month') {
      return 5; // Show 5 days before expiry
    } else if (plan === '3months' || plan === '3_months') {
      return 15; // Show 15 days before expiry
    } else if (plan === '1year' || plan === 'annual' || plan === '1_year') {
      return 30; // Show 30 days (1 month) before expiry
    }
    
    // Default: show 5 days before expiry for unknown plans
    return 5;
  };

  // Handle upgrade/payment
  const handleUpgrade = async () => {
    if (onUpgrade) {
      // Use provided callback
      await onUpgrade();
      return;
    }

    // Default: Start payment with default plan (1 month)
    setIsProcessingPayment(true);
    try {
      const defaultPlan = SUBSCRIPTION_PLANS_ARRAY.find(p => p.id === '1month') || SUBSCRIPTION_PLANS_ARRAY[0];
      const res = await fetch("/api/subscription/paychangu/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: defaultPlan.price, plan: defaultPlan.id }),
      });

      const data = await res.json();
      if (res.ok && data.checkout_url) {
        // Redirect to PayChangu checkout
        window.location.href = data.checkout_url;
      } else {
        const errorMessage = data.error || "Failed to start payment";
        console.error("Payment error:", errorMessage);
        alert(errorMessage);
      }
    } catch (err) {
      console.error("Payment error:", err);
      alert("An error occurred while starting payment. Please try again.");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  useEffect(() => {
    const calculateTimeRemaining = () => {
      if (!subscription) {
        setShouldShow(false);
        return;
      }

      const expiryDate = subscription.isTrial ? subscription.trialEndDate : subscription.expiresAt;
      if (!expiryDate) {
        setShouldShow(false);
        return;
      }

      const now = new Date();
      const expiry = new Date(expiryDate);
      const diff = expiry - now;

      if (diff <= 0) {
        setIsExpired(true);
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        setUrgencyLevel('expired');
        setShouldShow(true); // Always show if expired
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeRemaining({ days, hours, minutes, seconds });

      // Get countdown threshold for this plan
      const threshold = getCountdownThreshold();
      
      // Only show banner if within countdown threshold
      setShouldShow(days <= threshold);

      // Determine urgency level
      const totalHours = days * 24 + hours;
      if (totalHours <= 24) {
        setUrgencyLevel('urgent');
      } else if (totalHours <= 72) {
        setUrgencyLevel('warning');
      } else {
        setUrgencyLevel('normal');
      }
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [subscription, isTrialActive]);

  // Don't show if shouldShow is false
  if (!subscription || !shouldShow) {
    return null;
  }

  const getBannerStyles = () => {
    switch (urgencyLevel) {
      case 'expired':
        return {
          gradient: 'from-red-500 via-orange-500 to-red-600',
          bg: 'from-red-50 to-orange-50',
          border: 'border-red-300',
          text: 'text-red-900',
          icon: 'text-red-600',
          button: 'from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700',
          pulse: 'animate-pulse'
        };
      case 'urgent':
        return {
          gradient: 'from-orange-500 via-red-500 to-orange-600',
          bg: 'from-orange-50 to-red-50',
          border: 'border-orange-300',
          text: 'text-orange-900',
          icon: 'text-orange-600',
          button: 'from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700',
          pulse: 'animate-pulse'
        };
      case 'warning':
        return {
          gradient: 'from-yellow-400 via-orange-400 to-yellow-500',
          bg: 'from-yellow-50 to-orange-50',
          border: 'border-yellow-300',
          text: 'text-yellow-900',
          icon: 'text-yellow-600',
          button: 'from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700',
          pulse: ''
        };
      default:
        return {
          gradient: 'from-blue-500 via-indigo-500 to-blue-600',
          bg: 'from-blue-50 to-indigo-50',
          border: 'border-blue-300',
          text: 'text-blue-900',
          icon: 'text-blue-600',
          button: 'from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700',
          pulse: ''
        };
    }
  };

  const styles = getBannerStyles();
  const expiryDate = subscription.isTrial ? subscription.trialEndDate : subscription.expiresAt;
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'long',
      timeStyle: 'short'
    }).format(new Date(dateStr));
  };

  return (
    <div className={`relative overflow-hidden bg-gradient-to-r ${styles.bg} border-2 ${styles.border} rounded-2xl shadow-xl mb-8 ${styles.pulse}`}>
      {/* Animated background gradient */}
      <div className={`absolute inset-0 bg-gradient-to-r ${styles.gradient} opacity-5`}></div>
      
      {/* Sparkle decoration */}
      <div className="absolute top-4 right-4 opacity-20">
        <Sparkles className={`h-8 w-8 ${styles.icon}`} />
      </div>

      <div className="relative p-6 md:p-8">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          {/* Left Section - Info */}
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-4">
              <div className={`flex-shrink-0 p-3 rounded-xl bg-white bg-opacity-80 backdrop-blur-sm ${styles.icon}`}>
                {isExpired ? (
                  <AlertCircle className="h-8 w-8" />
                ) : (
                  <Clock className="h-8 w-8" />
                )}
              </div>
              <div>
                <h3 className={`text-2xl font-bold ${styles.text} mb-1`}>
                  {isExpired 
                    ? (subscription.isTrial ? 'Trial Expired' : 'Subscription Expired')
                    : (subscription.isTrial ? 'Trial Ending Soon' : 'Subscription Expiring Soon')
                  }
                </h3>
                <p className={`${styles.text} opacity-80 text-sm`}>
                  {isExpired 
                    ? 'Your access has expired. Renew now to continue using all features.'
                    : expiryDate && `Expires on ${formatDate(expiryDate)}`
                  }
                </p>
              </div>
            </div>

            {/* Countdown Timer */}
            {!isExpired && (
              <div className="flex items-center gap-4 mt-4">
                <div className="flex items-center gap-6">
                  {timeRemaining.days > 0 && (
                    <div className="text-center">
                      <div className={`text-3xl font-bold ${styles.text} mb-1`}>
                        {String(timeRemaining.days).padStart(2, '0')}
                      </div>
                      <div className={`text-xs font-medium ${styles.text} opacity-70 uppercase tracking-wide`}>
                        {tt('Days')}
                      </div>
                    </div>
                  )}
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${styles.text} mb-1`}>
                      {String(timeRemaining.hours).padStart(2, '0')}
                    </div>
                    <div className={`text-xs font-medium ${styles.text} opacity-70 uppercase tracking-wide`}>
                      {tt('Hours')}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${styles.text} mb-1`}>
                      {String(timeRemaining.minutes).padStart(2, '0')}
                    </div>
                    <div className={`text-xs font-medium ${styles.text} opacity-70 uppercase tracking-wide`}>
                      {tt('Minutes')}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${styles.text} mb-1 ${timeRemaining.days === 0 ? 'animate-pulse' : ''}`}>
                      {String(timeRemaining.seconds).padStart(2, '0')}
                    </div>
                    <div className={`text-xs font-medium ${styles.text} opacity-70 uppercase tracking-wide`}>
                      {tt('Seconds')}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Section - Actions */}
          <div className="flex flex-col sm:flex-row gap-3 lg:flex-shrink-0">
            <button
              onClick={handleUpgrade}
              disabled={isProcessingPayment}
              className={`inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r ${styles.button} text-white font-semibold rounded-xl shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-opacity-50 focus:ring-white disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isProcessingPayment ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  {tt('Processing...')}
                </>
              ) : (
                <>
                  <Crown className="h-5 w-5 mr-2" />
                  {isExpired ? tt('Renew Now') : tt('Upgrade Now')}
                  <ArrowRight className="h-5 w-5 ml-2" />
                </>
              )}
            </button>
            {urgencyLevel === 'urgent' || isExpired ? (
              <Link
                href="/subscription"
                className={`inline-flex items-center justify-center px-6 py-3 bg-white ${styles.text} font-semibold rounded-xl border-2 ${styles.border} hover:bg-opacity-90 transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-opacity-50 focus:ring-white shadow-md`}
              >
                <Zap className="h-5 w-5 mr-2" />
                {tt('View Plans')}
              </Link>
            ) : null}
          </div>
        </div>

        {/* Progress Bar */}
        {!isExpired && expiryDate && (subscription.isTrial || subscription.trialEndDate) && (
          <div className="mt-6">
            <div className="flex items-center justify-between text-xs font-medium mb-2">
              <span className={styles.text}>{tt('Time Remaining')}</span>
              <span className={styles.text}>
                {Math.round((timeRemaining.days * 24 + timeRemaining.hours) / (subscription.isTrial ? 3 : 30) * 100)}%
              </span>
            </div>
            <div className="h-2 bg-white bg-opacity-50 rounded-full overflow-hidden">
              <div 
                className={`h-full bg-gradient-to-r ${styles.gradient} transition-all duration-1000 ease-out`}
                style={{ 
                  width: `${Math.min(100, Math.max(0, (timeRemaining.days * 24 + timeRemaining.hours) / (subscription.isTrial ? 72 : 720) * 100))}%` 
                }}
              ></div>
            </div>
          </div>
        )}

        {/* Urgency Message */}
        {(urgencyLevel === 'urgent' || urgencyLevel === 'warning') && !isExpired && (
          <div className={`mt-4 p-3 rounded-lg bg-white bg-opacity-60 backdrop-blur-sm ${styles.text}`}>
            <p className="text-sm font-medium">
              {urgencyLevel === 'urgent' 
                ? '⚠️ Your subscription expires in less than 24 hours! Renew now to avoid service interruption.'
                : '⏰ Your subscription expires soon. Renew early to ensure uninterrupted access to all features.'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionCountdownBanner;
