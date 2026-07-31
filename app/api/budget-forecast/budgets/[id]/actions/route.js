import { NextResponse } from 'next/server';
import { withBudgetForecastAuth } from '@/lib/budgetForecast/http';
import {
  submitBudgetForReview,
  approveBudget,
  requestBudgetChanges,
  activateBudget,
  lockBudget,
  unlockBudget,
  archiveBudget,
  createBudgetRevision,
} from '@/lib/budgetForecast/application/budgetService';

const COMMANDS = {
  submit: { fn: submitBudgetForReview, perm: 'budgets.update' },
  approve: { fn: approveBudget, perm: 'budgets.approve' },
  requestChanges: { fn: requestBudgetChanges, perm: 'budgets.approve' },
  activate: { fn: activateBudget, perm: 'budgets.approve' },
  lock: { fn: lockBudget, perm: 'budgets.approve' },
  unlock: { fn: unlockBudget, perm: 'budgets.approve' },
  archive: { fn: archiveBudget, perm: 'budgets.update' },
  revise: { fn: createBudgetRevision, perm: 'budgets.update' },
};

export async function POST(request, { params }) {
  const body = await request.json().catch(() => ({}));
  const command = body.command || body.action;
  const entry = COMMANDS[command];
  if (!entry) {
    return NextResponse.json({ error: 'Unknown command', code: 'UNKNOWN_COMMAND' }, { status: 400 });
  }

  return withBudgetForecastAuth(request, entry.perm, async (user) => {
    const { id } = await params;
    // Reject arbitrary status mutation
    if (body.status) {
      return NextResponse.json(
        { error: 'Direct status mutation is not allowed. Use intent commands.', code: 'STATUS_MUTATION_FORBIDDEN' },
        { status: 400 }
      );
    }
    const data = await entry.fn(user.tenantId, id, user.id, {
      reason: body.reason,
      changeReason: body.changeReason || body.reason,
    });
    return NextResponse.json({ success: true, data });
  });
}
