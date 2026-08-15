"use client";
import { tt } from '@/lib/i18n/runtime';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AffiliatePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the proper affiliate dashboard
    router.replace('/affiliate/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-gray-600">{tt('Redirecting to affiliate dashboard...')}</p>
      </div>
    </div>
  );
} 