import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma.js';
import { guardPlanningRoute, accountingErrorResponse } from '../../../../lib/financialPlanning/api/routeGuard.js';
import { PLANNING_PERMISSIONS } from '../../../../lib/financialPlanning/permissions.js';
import {
  listBudgets,
  createBudget,
  approveBudget,
} from '../../../../lib/financialPlanning/application/budgetService.js';

export async function GET(request) {
  try {
    const guard = await guardPlanningRoute(request, PLANNING_PERMISSIONS.VIEW_BUDGETS);
    if (guard.response) return guard.response;
    const budgets = await listBudgets(prisma, guard.context.businessId);
    return NextResponse.json({ budgets });
  } catch (error) {
    return accountingErrorResponse(error, 'list budgets');
  }
}

export async function POST(request) {
  try {
    const guard = await guardPlanningRoute(request, PLANNING_PERMISSIONS.CREATE_BUDGET);
    if (guard.response) return guard.response;
    const body = await request.json();
    if (body.action === 'approve') {
      const approveGuard = await guardPlanningRoute(request, PLANNING_PERMISSIONS.APPROVE_BUDGET);
      if (approveGuard.response) return approveGuard.response;
      const budget = await approveBudget(prisma, approveGuard.context, body.budgetId);
      return NextResponse.json({ budget });
    }
    const budget = await createBudget(prisma, guard.context, body);
    return NextResponse.json({ budget }, { status: 201 });
  } catch (error) {
    return accountingErrorResponse(error, 'create/approve budget');
  }
}
