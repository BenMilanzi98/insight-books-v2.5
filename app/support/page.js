"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Mail, Clock } from "lucide-react";

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
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
          <h1 className="text-3xl font-bold text-gray-900">Support Center</h1>
        </div>

        {/* Disabled Message */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-6">
            <MessageCircle className="h-8 w-8 text-blue-600" />
          </div>
          
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Support Center Temporarily Unavailable
          </h2>
          
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            We're currently updating our support system to provide you with better assistance. 
            Our support team is still available to help you with any questions or issues.
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

          {/* Support Information */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-6">Support Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <Mail className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                <h4 className="font-medium text-gray-900 mb-1">Email Support</h4>
                <p className="text-sm text-gray-600">support@insightbooks.com</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <Clock className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                <h4 className="font-medium text-gray-900 mb-1">Business Hours</h4>
                <p className="text-sm text-gray-600">Mon-Fri 8:00 AM - 6:00 PM (CAT)</p>
              </div>
            </div>
          </div>

          {/* Common Issues */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Common Issues</h3>
            <div className="text-left max-w-2xl mx-auto">
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-start">
                  <span className="text-green-600 mr-2">•</span>
                  <span>Can't access your account? Try resetting your password or contact support.</span>
                </div>
                <div className="flex items-start">
                  <span className="text-green-600 mr-2">•</span>
                  <span>Having trouble with invoicing? Our team can guide you through the process.</span>
                </div>
                <div className="flex items-start">
                  <span className="text-green-600 mr-2">•</span>
                  <span>Need help with financial reports? We can assist with setup and interpretation.</span>
                </div>
                <div className="flex items-start">
                  <span className="text-green-600 mr-2">•</span>
                  <span>Technical issues? Provide details and we'll help resolve them quickly.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}