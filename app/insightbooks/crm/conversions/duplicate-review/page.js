'use client';
import { tt } from '@/lib/i18n/runtime';



/**

 * Thin duplicate-review workspace stub — Phase 16 Wave 2.

 * POSSIBLE_MATCH blocks create; no auto-merge.

 */

export default function ConversionDuplicateReviewPage() {

  return (

    <main style={{ padding: '1.5rem', maxWidth: 720 }}>

      <h1>{tt('Conversion duplicate review')}</h1>

      <p>

        Possible customer matches require human review. Auto-merge is forbidden.

        Use the admin CRM conversion duplicate-review API to inspect match

        decisions.

      </p>

      <ul>

        <li>{tt('EXACT / HIGH_CONFIDENCE → link only')}</li>

        <li>{tt('POSSIBLE_MATCH → block create')}</li>

        <li>{tt('CONFLICT → escalate')}</li>

        <li>{tt('NO_MATCH → create allowed')}</li>

      </ul>

    </main>

  );

}


