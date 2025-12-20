"use client";
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';

// Component that uses useSearchParams
function SubscriptionErrorContent() {
  const searchParams = useSearchParams();
  const message = searchParams.get('msg') || 'An error occurred during subscription';

  const getErrorMessage = (msg) => {
    switch (msg) {
      case 'Configuration error':
        return 'There was a configuration issue with the payment service. Please contact support.';
      case 'Missing transaction reference':
        return 'The payment reference is missing. Please try again or contact support.';
      case 'Payment verification failed':
        return 'We could not verify your payment. Please check your payment method and try again.';
      case 'Invalid verification response':
        return 'There was an issue verifying your payment. Please try again.';
      case 'Payment not completed':
        return 'Your payment was not completed. Please try again or use a different payment method.';
      case 'Subscription not found':
        return 'We could not find your subscription. Please contact support.';
      case 'Failed to activate subscription':
        return 'Your payment was received but we could not activate your subscription. Please contact support.';
      case 'Server error':
        return 'A server error occurred. Please try again or contact support.';
      default:
        return 'An unexpected error occurred. Please try again or contact support.';
    }
  };

  const getErrorType = (msg) => {
    if (msg.includes('Configuration') || msg.includes('Server error')) {
      return 'error';
    } else if (msg.includes('Payment') || msg.includes('verification')) {
      return 'warning';
    } else {
      return 'info';
    }
  };

  const errorType = getErrorType(message);
  const errorMessage = getErrorMessage(message);

  const getErrorStyles = () => {
    switch (errorType) {
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  const getIconColor = () => {
    switch (errorType) {
      case 'error':
        return 'text-red-600';
      case 'warning':
        return 'text-yellow-600';
      default:
        return 'text-blue-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Subscription Error
          </h1>
          <p className="text-gray-600">
            We encountered an issue with your subscription
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className={`rounded-lg border p-4 mb-6 ${getErrorStyles()}`}>
            <div className="flex items-center space-x-3">
              <AlertTriangle className={`h-5 w-5 ${getIconColor()}`} />
              <div>
                <h3 className="font-medium">
                  {message}
                </h3>
                <p className="text-sm mt-1 opacity-90">
                  {errorMessage}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              <p className="mb-4">
                Don't worry, your account is safe and no charges have been made. Here are some things you can try:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Check your payment method details</li>
                <li>Ensure you have sufficient funds</li>
                <li>Try using a different payment method</li>
                <li>Clear your browser cache and try again</li>
              </ul>
            </div>

            <div className="flex flex-col space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </button>

              <Link
                href="/subscription"
                className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Subscription
              </Link>

              <Link
                href="/dashboard"
                className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Go to Dashboard
              </Link>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="text-center">
                <p className="text-sm text-gray-500">
                  Still having issues? Contact our support team
                </p>
                <Link
                  href="/contact"
                  className="text-sm text-blue-600 hover:text-blue-500 font-medium"
                >
                  Get Help
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Loading fallback component
function SubscriptionErrorLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Subscription Error
          </h1>
          <p className="text-gray-600">
            Loading error details...
          </p>
        </div>
      </div>
    </div>
  );
}

// Main page component with Suspense boundary
export default function SubscriptionErrorPage() {
  return (
    <Suspense fallback={<SubscriptionErrorLoading />}>
      <SubscriptionErrorContent />
    </Suspense>
  );
}
