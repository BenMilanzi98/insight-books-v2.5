"use client";
import { tt } from '@/lib/i18n/runtime';

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Low stock alerts view. Redirects to main stock page with tab so
 * the dashboard link /stock/low-stock does not 404.
 */
export default function LowStockPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/stock?tab=low-stock");
  }, [router]);
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <p className="text-gray-500">{tt('Redirecting to Stock…')}</p>
    </div>
  );
}
