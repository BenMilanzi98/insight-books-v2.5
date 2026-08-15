"use client";
import { tt } from '@/lib/i18n/runtime';
import { Crown, Lock, ArrowRight, Star } from 'lucide-react';

const PremiumFeatureBlock = ({ 
  featureName = "Premium Feature", 
  description = "This feature is only available with a premium subscription.",
  onUpgrade,
  className = "" 
}) => {
  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      window.location.href = '/subscription';
    }
  };

  return (
    <div className={`bg-gradient-to-br from-blue-50 to-sky-50 border border-blue-200 rounded-lg p-8 text-center ${className}`}>
      <div className="max-w-md mx-auto">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="relative">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-sky-600 rounded-full flex items-center justify-center">
              <Crown className="h-8 w-8 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
              <Star className="h-3 w-3 text-yellow-800" fill="currentColor" />
            </div>
          </div>
        </div>

        {/* Content */}
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          {featureName} - Premium Feature
        </h3>
        
        <p className="text-gray-600 mb-6">
          {description}
        </p>

        <div className="bg-white border border-blue-100 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-center space-x-2 text-sm text-blue-700">
            <Lock className="h-4 w-4" />
            <span className="font-medium">{tt('Upgrade Required')}</span>
          </div>
        </div>

        {/* Benefits List */}
        <div className="text-left mb-6">
          <h4 className="font-semibold text-gray-900 mb-3 text-center">
            {tt('Premium Plan includes:')}
          </h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-center">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-3"></div>
              POS (Point of Sale)
            </li>
            <li className="flex items-center">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-3"></div>
              {tt('Inventory Tracking')}
            </li>
            <li className="flex items-center">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-3"></div>
              {tt('Expenses Tracking')}
            </li>
            <li className="flex items-center">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-3"></div>
              {tt('Invoices')}
            </li>
            <li className="flex items-center">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-3"></div>
              {tt('Quotations')}
            </li>
            <li className="flex items-center">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-3"></div>
              {tt('Customer Database')}
            </li>
            <li className="flex items-center">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-3"></div>
              {tt('Financial Reporting')}
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={handleUpgrade}
            className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-blue-600 to-sky-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
          >
            <Crown className="h-4 w-4 mr-2" />
            {tt('Upgrade to Premium')}
            <ArrowRight className="h-4 w-4 ml-2" />
          </button>
          
          <button
            onClick={() => window.location.href = '/subscription'}
            className="inline-flex items-center justify-center px-6 py-3 bg-white text-blue-600 font-medium rounded-lg border border-blue-300 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
          >
            {tt('View Pricing Plans')}
          </button>
        </div>

        {/* Small disclaimer */}
        <p className="text-xs text-gray-500 mt-4">
          {tt('All premium features include a 30-day money-back guarantee')}
        </p>
      </div>
    </div>
  );
};

export default PremiumFeatureBlock; 