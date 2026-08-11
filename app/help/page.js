"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageCircle } from "lucide-react";

export default function HelpPage() {
  return (
    <div className="w-full py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Help Center</h1>
        </div>

        {/* Disabled Message */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 mb-6">
            <MessageCircle className="h-8 w-8 text-yellow-600" />
          </div>
          
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Help Center Temporarily Unavailable
          </h2>
          
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            We're currently updating our help documentation to provide you with the best possible support experience. 
            In the meantime, our support team is available to help you with any questions or issues.
          </p>

          {/* Support Information */}
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800 text-sm">
                <strong>💡 Tip:</strong> Look for the green WhatsApp button in the bottom-right corner of your screen for instant support!
              </p>
            </div>
            
            <p className="text-sm text-gray-500">
              Our support team typically responds within 2-4 hours during business days
            </p>
          </div>

          {/* Alternative Contact Info */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Other Ways to Get Help</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <strong>Email Support:</strong> support@insightbooks.com
              </div>
              <div>
                <strong>Business Hours:</strong> Mon-Fri 8:00 AM - 6:00 PM (CAT)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}