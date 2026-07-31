'use client';

import { use } from 'react';
import { CrmOpportunityDetailView } from '@/components/admin';

export default function CrmOpportunityDetailPage({ params }) {
  const resolved = use(params);
  return <CrmOpportunityDetailView opportunityId={resolved.opportunityId} />;
}
