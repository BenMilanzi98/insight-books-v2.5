import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { getCommercialDomainContract, hasCrmTaxRuleModel } from '@/lib/admin/crm/commercial';
import { resolveCrmAccess } from '@/lib/admin/crm/authz';

/**
 * Thin stub — list/create in-platform tax rules.
 * No Tenant GL tax posting; no MRA EIS fiscal submission.
 */
export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const access = resolveCrmAccess(admin);
    if (!(access.canViewOpportunities || access.canView || access.isSuperAdmin)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    if (!hasCrmTaxRuleModel(prisma)) {
      return NextResponse.json(
        {
          success: false,
          error: 'crm_tax_rule_model_unavailable',
          domain: getCommercialDomainContract(),
        },
        { status: 503 }
      );
    }

    const rules = await prisma.crmTaxRule.findMany({ where: {} });
    return NextResponse.json({
      success: true,
      taxRules: rules,
      domain: getCommercialDomainContract(),
      tenantTaxPosting: false,
      mraEisFiscal: false,
    });
  } catch (error) {
    console.error('CRM tax rules list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list CRM tax rules' },
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

    const access = resolveCrmAccess(admin);
    if (!(access.canEditOpportunities || access.isSuperAdmin)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    if (!hasCrmTaxRuleModel(prisma)) {
      return NextResponse.json(
        { success: false, error: 'crm_tax_rule_model_unavailable' },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const code = String(body.code || '').trim().toUpperCase();
    if (!code) {
      return NextResponse.json({ success: false, error: 'tax_rule_code_required' }, { status: 400 });
    }

    const now = new Date();
    const rule = await prisma.crmTaxRule.create({
      data: {
        code,
        jurisdiction: body.jurisdiction != null ? String(body.jurisdiction).trim() : null,
        status: 'ACTIVE',
        inclusiveDefault: body.inclusiveDefault === true,
        createdAt: now,
        updatedAt: now,
      },
    });

    return NextResponse.json(
      {
        success: true,
        taxRule: rule,
        domain: getCommercialDomainContract(),
        tenantTaxPosting: false,
        mraEisFiscal: false,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('CRM tax rules create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create CRM tax rule' },
      { status: 500 }
    );
  }
}
