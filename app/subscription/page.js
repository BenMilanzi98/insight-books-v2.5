"use client";
import { tt } from '@/lib/i18n/runtime';
import { useState, useEffect, Suspense } from "react";
import { Crown, Check, Star, ArrowRight, Clock, AlertCircle, Zap, Shield, Users, BarChart3, AlertTriangle } from "lucide-react";
import { useSearchParams } from 'next/navigation';
import {
  SUBSCRIPTION_PLANS_ARRAY,
  getStorefrontFeatures,
} from '@/lib/subscriptionConfig';
import SubscriptionCountdownBanner from '@/components/SubscriptionCountdownBanner';

// Client component that uses search params
function SubscriptionContent() {
  const [loading, setLoading] = useState(false);
  const [subLoading, setSubLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [remainingTrialDays, setRemainingTrialDays] = useState(0);
  const [isTrialActive, setIsTrialActive] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [storefrontPlans, setStorefrontPlans] = useState(SUBSCRIPTION_PLANS_ARRAY);
  
  const searchParams = useSearchParams();
  const redirected = searchParams.get('redirected');
  const reason = searchParams.get('reason');
  const successParam = searchParams.get('success');

  useEffect(() => {
    // Check for success parameter
    if (successParam === 'true') {
      setSuccess(true);
      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(false), 5000);
    }
  }, [successParam]);

  useEffect(() => {
    const fetchData = async () => {
      setSubLoading(true);
      setError(null);
      try {
        const [statusRes, plansRes] = await Promise.all([
          fetch("/api/subscription/status"),
          fetch("/api/subscription/plans"),
        ]);
        const data = await statusRes.json();
        const plansData = await plansRes.json().catch(() => ({}));

        if (statusRes.ok) {
          setSubscription(data.subscription);
          setPaymentHistory(data.paymentHistory);
          setSubscriptionStatus(data.subscriptionStatus);
          setRemainingTrialDays(data.remainingTrialDays || 0);
          setIsTrialActive(data.isTrialActive || false);
        } else {
          console.error("Failed to load subscription data", data.error);
          setError(data.error || "Failed to load subscription data");
        }

        if (plansRes.ok && Array.isArray(plansData.plans) && plansData.plans.length) {
          setStorefrontPlans(plansData.plans);
        }
      } catch (err) {
        console.error("Error fetching subscription data:", err);
        setError("Network error. Please check your connection and try again.");
      } finally {
        setSubLoading(false);
      }
    };

    fetchData();
  }, []);

  const startPayment = async (planId = '1month', amount = 30000) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/subscription/paychangu/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, plan: planId }),
      });

      const data = await res.json();
      if (res.ok && data.checkout_url) {
        // Redirect to PayChangu checkout
        window.location.href = data.checkout_url;
      } else {
        const errorMessage = data.error || "Failed to start payment";
        setError(errorMessage);
        console.error("Payment error:", errorMessage);
      }
    } catch (err) {
      console.error("Payment error:", err);
      setError("An error occurred while starting payment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) =>
    new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(dateStr));

  const pricingPlans = storefrontPlans.map((plan) => ({
    ...plan,
    name: plan.displayName || plan.name,
    price: String(plan.priceFormatted || '')
      .replace(/MK/gi, '')
      .replace(/,/g, '')
      .trim(),
    amount: plan.price || 0,
    popular: plan.popular || plan.highlight || plan.name === '1 Year',
    features: getStorefrontFeatures(plan),
  }));

  const noActiveSubscription = !isTrialActive && !subscription?.isActive;

  if (subLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-96 bg-gray-200 rounded"></div>
            <div className="h-96 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Success Message */}
      {success && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-green-900 mb-2">
                {tt('Payment Successful!')}
              </h3>
              <p className="text-green-700">
                {tt('Your subscription has been activated successfully. You now have access to all premium features.')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-red-900 mb-2">
                {tt('Error')}
              </h3>
              <p className="text-red-700">
                {error}
              </p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Access Restricted / Redirected Message */}
      {(redirected || noActiveSubscription) && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-red-900 mb-2">
                {redirected ? (reason === 'no_subscription' ? 'Access Restricted' : 'Subscription Required') : 'Access Restricted'}
              </h3>
              <p className="text-red-700">
                {redirected
                  ? (reason === 'no_subscription'
                      ? 'Your free trial has ended or you don\'t have an active subscription. Please upgrade to continue accessing the application.'
                      : reason === 'api_error'
                      ? 'We encountered an issue checking your subscription status. Please upgrade to ensure uninterrupted access.'
                      : reason === 'subscription_required'
                      ? 'An active subscription is required to continue using the application. Please upgrade your subscription to continue.'
                      : 'Please upgrade your subscription to continue using the application.')
                  : 'Your free trial has ended or you don\'t have an active subscription. Please upgrade to continue accessing the application.'}
              </p>
              {(reason === 'no_subscription' || noActiveSubscription) && (
                <p className="text-sm text-red-600 mt-2">
                  {tt('All features are locked until you choose a subscription plan.')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Subscription Countdown Banner */}
      {(isTrialActive || subscription) && (
        <SubscriptionCountdownBanner 
          subscription={{
            ...subscription,
            isTrial: subscription?.isTrial !== undefined ? subscription.isTrial : isTrialActive,
            trialEndDate: subscription?.trialEndDate || null,
            expiresAt: subscription?.expiresAt || null,
            plan: subscription?.plan || subscriptionStatus?.plan || null
          }}
          isTrialActive={isTrialActive}
          remainingTrialDays={remainingTrialDays}
          onUpgrade={async () => {
            // Use the same payment flow as package cards
            // Default to 1 month plan for upgrade
            const defaultPlan = pricingPlans.find(p => p.id === '1month') || pricingPlans[0];
            await startPayment(defaultPlan.id, defaultPlan.amount);
          }}
        />
      )}

      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          {redirected || noActiveSubscription ? "Upgrade Required" : isTrialActive ? tt('Upgrade Your Trial') : tt('Subscription & Payments')}
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          {redirected || noActiveSubscription
            ? "Choose a subscription plan to unlock all features and continue using the application."
            : isTrialActive ? tt('Unlock premium features and continue growing your business with our professional plans.') : tt('Manage your subscription and view payment history.')}
        </p>
      </div>

      {/* Trial Status Banner */}
      {isTrialActive && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <Clock className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-blue-900">
                  {tt('Free Trial Active')}
                </h3>
                <p className="text-blue-700">
                  {remainingTrialDays > 0 
                    ? `${remainingTrialDays} day${remainingTrialDays !== 1 ? 's' : ''} remaining in your trial`
                    : "Your trial has ended - upgrade now to continue"
                  }
                </p>
                {subscription?.trialEndDate && (
                  <p className="text-sm text-blue-600 mt-1">
                    Trial ends: {formatDate(subscription.trialEndDate)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex-shrink-0">
              <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                {remainingTrialDays} days left
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expired Trial Message */}
      {noActiveSubscription && (
        <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-xl p-6">
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              <AlertCircle className="h-8 w-8 text-orange-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-orange-900 mb-2">
                {tt('Trial Expired')}
              </h3>
              <p className="text-orange-700">
                {tt('Your free trial has ended. To continue using all features, please choose a subscription plan below.')}
              </p>
              <p className="text-sm text-orange-600 mt-2">
                {tt('All your data is safe and will be restored once you upgrade.')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pricing Plans — always available so core upgrades and EIS add-ons can be purchased */}
      {pricingPlans.length > 0 && (
        <div className="space-y-10">
          {[
            {
              title: 'InsightBooks subscriptions',
              items: pricingPlans.filter((p) => !p.requiresEIS),
            },
            {
              title: 'MRA EIS plans',
              subtitle:
                'Add-on for electronic invoicing. Payment activates the commercial subscription; entitlement review is still required before setup/transmit.',
              items: pricingPlans.filter((p) => p.requiresEIS),
            },
          ]
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <div key={group.title}>
                <h2 className="text-xl font-semibold text-gray-900 mb-2 text-center">
                  {group.title}
                </h2>
                {group.subtitle ? (
                  <p className="text-sm text-gray-600 text-center max-w-2xl mx-auto mb-6">
                    {group.subtitle}
                  </p>
                ) : (
                  <div className="mb-6" />
                )}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {group.items.map((plan) => (
                    <div
                      key={plan.id}
                      className={`relative bg-white rounded-xl shadow-lg border-2 ${
                        plan.popular
                          ? 'border-blue-500 ring-4 ring-blue-100'
                          : 'border-gray-200'
                      } p-8`}
                    >
                      {(plan.popular || plan.badge) && (
                        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                          <div className="bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-medium flex items-center">
                            <Star className="h-3 w-3 mr-1" />
                            {plan.badge || 'Most Popular'}
                          </div>
                        </div>
                      )}

                      <div className="text-center mb-6">
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                        <div className="mb-4">
                          <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                          <span className="text-gray-600">/{plan.period}</span>
                        </div>
                        <p className="text-gray-600">
                          {plan.requiresEIS
                            ? 'MRA Electronic Invoicing (EIS) commercial plan'
                            : plan.savings || 'Full InsightBooks platform access'}
                        </p>
                      </div>

                      <ul className="space-y-3 mb-8">
                        {(plan.features || []).map((feature, featureIndex) => (
                          <li key={featureIndex} className="flex items-start">
                            <Check className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                            <span className="text-gray-700">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <button
                        onClick={() => startPayment(plan.id, plan.amount)}
                        disabled={loading}
                        className={`w-full py-3 px-6 rounded-lg font-medium transition-all duration-200 ${
                          plan.popular
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-300'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {loading ? (
                          <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current mr-2"></div>
                            {tt('Processing...')}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center">
                            {plan.popular && <Crown className="h-4 w-4 mr-2" />}
                            {plan.requiresEIS
                              ? plan.ctaText || 'Subscribe to MRA EIS'
                              : redirected
                                ? 'Choose Plan'
                                : isTrialActive ? tt('Upgrade Now') : tt('Choose Plan')}
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </div>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Features Comparison - Show if in trial mode OR if redirected */}
      {(isTrialActive || redirected) && (
        <div className="bg-gray-50 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            {tt("What's Included in Premium Plans")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Zap className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{tt('MRA E-Invoicing')}</h3>
              <p className="text-gray-600 text-sm">
                {tt('Direct integration with Malawi Revenue Authority for seamless tax compliance')}
              </p>
            </div>
            <div className="text-center">
              <div className="bg-green-100 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{tt('Advanced Reports')}</h3>
              <p className="text-gray-600 text-sm">
                {tt('Comprehensive financial analytics and business intelligence reports')}
              </p>
            </div>
            <div className="text-center">
              <div className="bg-purple-100 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{tt('Multi-User Access')}</h3>
              <p className="text-gray-600 text-sm">
                {tt('Collaborate with your team with role-based permissions and access control')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Current Subscription Status */}
      {!isTrialActive && (
        <div className="bg-white rounded-xl shadow border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{tt('Current Subscription Status')}</h2>
          
          {!subscription?.isActive ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-yellow-600 mr-3" />
                <div>
                  <p className="text-yellow-800 font-medium">{tt('No Active Subscription')}</p>
                  <p className="text-yellow-700 text-sm">{tt('Choose a plan above to get started')}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Check className="h-5 w-5 text-green-600 mr-3" />
                  <div>
                    <p className="text-green-800 font-medium">{tt('Subscription Active')}</p>
                    <p className="text-green-700 text-sm">
                      Next renewal: {formatDate(subscription.expiresAt)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-green-600">
                    {subscription.plan} Plan
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payment History */}
      <div className="bg-white rounded-xl shadow border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">{tt('Payment History')}</h2>
        <div className="overflow-auto rounded-lg">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tt('Date')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tt('Transaction')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tt('Amount')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tt('Status')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tt('Type')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paymentHistory && paymentHistory.length > 0 ? (
                paymentHistory.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {formatDate(payment.paymentDate)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-mono">
                      {payment.txRef}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {payment.amount} {payment.currency}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          payment.status === "Completed"
                            ? "bg-green-100 text-green-800"
                            : payment.status === "Pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          payment.isTrial
                            ? "bg-blue-100 text-blue-800"
                            : "bg-purple-100 text-purple-800"
                        }`}
                      >
                        {payment.isTrial ? tt('Trial') : tt('Paid')}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                    {tt('No payment history found.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ Section - Only show if in trial mode */}
      {isTrialActive && (
        <div className="bg-gray-50 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">{tt('Frequently Asked Questions')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Can I cancel anytime?</h3>
              <p className="text-gray-600 text-sm">{tt('Yes, you can cancel your subscription at any time. No long-term contracts required.')}</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Is there a money-back guarantee?</h3>
              <p className="text-gray-600 text-sm">{tt('We offer a 30-day money-back guarantee for all paid plans.')}</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">What happens when my trial ends?</h3>
              <p className="text-gray-600 text-sm">{tt("You'll need to upgrade to a paid plan to continue accessing all features.")}</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Can I change plans later?</h3>
              <p className="text-gray-600 text-sm">{tt('Yes, you can upgrade or downgrade your plan at any time from your account settings.')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Loading fallback component
function SubscriptionLoading() {
  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-96 bg-gray-200 rounded"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  );
}

// Main page component with Suspense boundary
export default function PaymentPage() {
  return (
    <Suspense fallback={<SubscriptionLoading />}>
      <SubscriptionContent />
    </Suspense>
  );
}
