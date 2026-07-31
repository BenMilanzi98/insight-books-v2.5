"use client";

import TaxManagementNav from "@/components/tax/TaxManagementNav";

export default function TaxManagementLayout({ children }) {
  return (
    <div className="px-2 sm:px-4">
      <TaxManagementNav />
      {children}
    </div>
  );
}
