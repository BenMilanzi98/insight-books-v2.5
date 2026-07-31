import { NextResponse } from 'next/server';

/**
 * Legacy direct MRA Sale submit — disabled in Phase 11.
 * Use /api/mra-eis/sales-eligibility (preflight) and canonical POS/Invoice finalization,
 * which create a local bridge + outbox for Phase 12. No MRA Sale API call occurs in Phase 11.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'MRA_EIS_LEGACY_SUBMIT_DISABLED',
        message:
          'Direct MRA invoice submission is disabled. Finalize the sale through InsightBooks POS or Sales Invoice flows. Phase 11 creates a local EIS bridge only; Phase 12 owns fiscal snapshots. No MRA Sale was submitted.',
        requiredAction: 'USE_CANONICAL_FINALIZATION',
        phase: 11,
        mraSubmitted: false,
      },
    },
    { status: 410 }
  );
}
