'use client';

import { use } from 'react';
import { CrmLeadDetailView } from '@/components/admin';

export default function CrmLeadDetailPage({ params }) {
  const resolved = use(params);
  return <CrmLeadDetailView leadId={resolved?.leadId} />;
}
