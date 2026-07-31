'use client';

import { use } from 'react';
import { SupportTicketDetailView } from '@/components/admin';

export default function SupportTicketDetailPage({ params }) {
  const resolved = use(params);
  return <SupportTicketDetailView ticketId={resolved?.id} />;
}
