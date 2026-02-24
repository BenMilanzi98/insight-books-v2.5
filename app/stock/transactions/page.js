"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Stock transactions view. Redirects to main stock page with tab so
 * the dashboard link /stock/transactions does not 404.
 */
export default function StockTransactionsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/stock?tab=transactions");
  }, [router]);
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <p className="text-gray-500">Redirecting to Stock…</p>
    </div>
  );
}
