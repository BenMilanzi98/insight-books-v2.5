"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HRDashboard() {
  const router = useRouter();
 
  useEffect(() => {
    // Redirect to employees page by default
    router.push('/hr/employees');
  }, [router]);

  return (
    <div className="p-6">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
        <div className="h-10 bg-gray-200 rounded w-full mb-4"></div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
              </div>
              </div>
            </div>
  );
}