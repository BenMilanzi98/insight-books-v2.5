/**

 * Thin duplicate-review stub — Phase 16 Wave 2.

 * POSSIBLE_MATCH / CONFLICT require human decision; no auto-merge.

 */

import { NextResponse } from 'next/server';

import { getAdminFromRequest } from '@/lib/adminAuth';

import prisma from '@/lib/prisma';

import {

  matchPlatformCustomer,

  decideCustomerCreateOrLink,

  CRM_CUSTOMER_MATCH_STATE,

} from '@/lib/admin/crm';



export async function GET(request) {

  try {

    const admin = await getAdminFromRequest(request);

    if (!admin) {

      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    }



    const { searchParams } = new URL(request.url);

    const conversionId = searchParams.get('conversionId');

    if (!conversionId) {

      return NextResponse.json(

        { success: false, error: 'conversionId_required' },

        { status: 400 }

      );

    }



    if (typeof prisma?.crmConversionMatchDecision?.findMany !== 'function') {

      return NextResponse.json({

        success: true,

        status: 'NOT_AVAILABLE',

        decisions: [],

        note: 'Match decision model unavailable',

      });

    }



    const decisions = await prisma.crmConversionMatchDecision.findMany({

      where: { conversionId },

      orderBy: { createdAt: 'desc' },

    });



    return NextResponse.json({

      success: true,

      decisions,

      autoMergeForbidden: true,

      possibleMatchBlocksCreate: true,

    });

  } catch (error) {

    console.error('duplicate-review GET failed:', error);

    return NextResponse.json(

      { success: false, error: 'duplicate_review_failed' },

      { status: 500 }

    );

  }

}



export async function POST(request) {

  try {

    const admin = await getAdminFromRequest(request);

    if (!admin) {

      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    }



    const body = await request.json();

    const match = await matchPlatformCustomer(prisma, {

      accountId: body.accountId,

      evidence: body.evidence || {},

    });



    if (

      match.matchState === CRM_CUSTOMER_MATCH_STATE.POSSIBLE_MATCH ||

      match.matchState === CRM_CUSTOMER_MATCH_STATE.CONFLICT

    ) {

      const decision = await decideCustomerCreateOrLink(prisma, {

        conversionId: body.conversionId,

        match,

        admin,

        action: body.action || 'CREATE',

      });

      return NextResponse.json({

        success: false,

        requiresReview: true,

        match,

        decision,

        autoMergeForbidden: true,

      });

    }



    return NextResponse.json({ success: true, match, autoMergeForbidden: true });

  } catch (error) {

    console.error('duplicate-review POST failed:', error);

    return NextResponse.json(

      { success: false, error: 'duplicate_review_failed' },

      { status: 500 }

    );

  }

}


