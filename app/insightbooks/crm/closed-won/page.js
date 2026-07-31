'use client';

import Link from 'next/link';
import { CrmStubView } from '@/components/admin';

/**
 * Phase 20 Wave 4 — thin Closed-Won alias → conversion readiness / queues.
 * Not a second conversion domain.
 */
export default function CrmClosedWonAliasPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 960 }}>
      <CrmStubView
        titleKey="admin-pages.crm.conversionHub.title"
        hintKey="admin-pages.crm.conversionHub.closedWonAliasHint"
        emptyTitleKey="admin-pages.crm.conversionHub.acceptedValueNotRevenue"
        emptyHintKey="admin-pages.crm.conversionHub.closedWonNotCollectedRevenue"
      />
      <ul style={{ marginTop: '1rem', lineHeight: 1.8 }}>
        <li>
          <Link href="/insightbooks/crm/conversions/overview">
            Conversion overview
          </Link>
        </li>
        <li>
          <Link href="/insightbooks/crm/conversions/queues">
            Conversion queues
          </Link>
        </li>
        <li>
          <Link href="/insightbooks/crm/closed-won/queues">
            Closed-Won queues alias
          </Link>
        </li>
      </ul>
    </div>
  );
}
