'use client';

import { use } from 'react';
import { CustomerSuccessCaseDetailView } from '@/components/admin';

export default function CustomerSuccessCaseDetailPage({ params }) {
  const resolved = use(params);
  return <CustomerSuccessCaseDetailView caseId={resolved?.id} />;
}
