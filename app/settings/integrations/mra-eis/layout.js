'use client';

import TenantMraEisSectionNav from '@/components/mraEis/TenantMraEisSectionNav';

export default function TenantMraEisLayout({ children }) {
  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6">
        <TenantMraEisSectionNav />
      </div>
      {children}
    </>
  );
}
