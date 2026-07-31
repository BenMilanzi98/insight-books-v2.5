'use client';



/**

 * Thin duplicate-review workspace stub — Phase 16 Wave 2.

 * POSSIBLE_MATCH blocks create; no auto-merge.

 */

export default function ConversionDuplicateReviewPage() {

  return (

    <main style={{ padding: '1.5rem', maxWidth: 720 }}>

      <h1>Conversion duplicate review</h1>

      <p>

        Possible customer matches require human review. Auto-merge is forbidden.

        Use the admin CRM conversion duplicate-review API to inspect match

        decisions.

      </p>

      <ul>

        <li>EXACT / HIGH_CONFIDENCE → link only</li>

        <li>POSSIBLE_MATCH → block create</li>

        <li>CONFLICT → escalate</li>

        <li>NO_MATCH → create allowed</li>

      </ul>

    </main>

  );

}


