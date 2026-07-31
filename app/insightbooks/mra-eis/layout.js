'use client';

import AdminMraEisSectionNav from '@/components/admin/AdminMraEisSectionNav';

export default function AdminMraEisLayout({ children }) {
  return (
    <>
      <AdminMraEisSectionNav />
      {children}
    </>
  );
}
