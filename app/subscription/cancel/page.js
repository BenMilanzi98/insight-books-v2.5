// pages/cancel.js
"use client";
import { tt } from '@/lib/i18n/runtime';
import { ArrowLeft, XCircle } from 'lucide-react';
import Link from 'next/link';

export default function CancelPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
        <div className="flex justify-center mb-4">
          <XCircle className="w-16 h-16 text-yellow-500" />
        </div>
        <h1 className="text-2xl font-bold mb-2 text-gray-800">{tt('Payment Cancelled')}</h1>
        <p className="text-gray-600 mb-6">
          {tt('Your subscription payment was cancelled. No charges have been made to your account.')}
        </p>
        <div className="space-y-3">
          <Link
            href="/subscription"
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white font-semibold px-6 py-2 rounded-lg transition w-full"
          >
            {tt('Try Again')}
          </Link>
          <Link
            href="/dashboard"
            className="inline-block bg-gray-500 hover:bg-gray-600 text-white font-semibold px-6 py-2 rounded-lg transition w-full"
          >
            {tt('Go to Dashboard')}
          </Link>
        </div>
        <div className="mt-4">
          <Link
            href="/"
            className="text-sm text-gray-500 hover:underline"
          >
            {tt('Go back to homepage')}
          </Link>
        </div>
      </div>
    </div>
  );
}
