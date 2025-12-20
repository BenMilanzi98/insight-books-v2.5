// app/api/accounts/templates/route.js
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { getAvailableTemplates, getTemplate } from '@/lib/accountTemplates';
import prisma from '@/lib/prisma';

/**
 * GET /api/accounts/templates
 * Get list of available account templates
 */
export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('id');

    if (templateId) {
      // Get specific template
      const template = getTemplate(templateId);
      if (!template) {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ template });
    }

    // Get list of all templates
    const templates = getAvailableTemplates();
    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Error fetching account templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch account templates', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/accounts/templates
 * Apply a template to create accounts
 * Body: { templateId: "retail", overwrite: false }
 */
export async function POST(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { templateId, overwrite = false } = body;

    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    const template = getTemplate(templateId);
    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    const results = {
      created: 0,
      skipped: 0,
      errors: [],
      accounts: [],
    };

    await prisma.$transaction(async (tx) => {
      for (const accountTemplate of template.accounts) {
        try {
          // Check if account already exists
          const existing = await tx.account.findFirst({
            where: {
              tenantId: user.tenantId,
              OR: [
                { accountCode: accountTemplate.code },
                { accountName: { equals: accountTemplate.name, mode: 'insensitive' } },
              ],
            },
          });

          if (existing) {
            if (overwrite) {
              // Update existing account
              const updated = await tx.account.update({
                where: { id: existing.id },
                data: {
                  accountCode: accountTemplate.code,
                  accountName: accountTemplate.name,
                  accountType: accountTemplate.type,
                  normalBalance: accountTemplate.normalBalance,
                  isActive: true,
                },
              });
              results.accounts.push(updated);
              results.created++;
            } else {
              results.skipped++;
            }
            continue;
          }

          // Create new account
          const account = await tx.account.create({
            data: {
              tenantId: user.tenantId,
              accountCode: accountTemplate.code,
              accountName: accountTemplate.name,
              accountType: accountTemplate.type,
              normalBalance: accountTemplate.normalBalance,
              isActive: true,
              balance: 0,
            },
          });

          results.accounts.push(account);
          results.created++;
        } catch (error) {
          results.errors.push({
            accountCode: accountTemplate.code,
            accountName: accountTemplate.name,
            error: error.message,
          });
        }
      }
    });

    return NextResponse.json({
      message: `Template applied successfully. Created: ${results.created}, Skipped: ${results.skipped}`,
      results,
    }, { status: 201 });
  } catch (error) {
    console.error('Error applying account template:', error);
    return NextResponse.json(
      { error: 'Failed to apply account template', details: error.message },
      { status: 500 }
    );
  }
}










