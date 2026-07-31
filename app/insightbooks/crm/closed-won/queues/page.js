'use client';

import Link from 'next/link';
import { CrmStubView } from '@/components/admin';

/**
 * Phase 20 Wave 4 — thin Closed-Won queues alias → conversion queues.
 */
export default function CrmClosedWonQueuesAliasPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 960 }}>
      <CrmStubView
        titleKey="admin-pages.crm.conversionHub.queues"
        hintKey="admin-pages.crm.conversionHub.closedWonAliasHint"
        emptyTitleKey="admin-pages.crm.conversionsQueues.emptyTitle"
        emptyHintKey="admin-pages.crm.conversionsQueues.emptyHint"
      />
      <p style={{ marginTop: '1rem' }}>
        <Link href="/insightbooks/crm/conversions/queues">
          Open canonical conversion queues
        </Link>
      </p>
    </div>
  );
}
