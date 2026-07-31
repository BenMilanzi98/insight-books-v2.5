import { NextResponse } from 'next/server';
import { withBudgetForecastAuth } from '@/lib/budgetForecast/http';
import {
  regenerateForecast,
  submitForecastForReview,
  approveForecast,
  activateForecast,
  lockForecast,
  archiveForecast,
} from '@/lib/budgetForecast/application/forecastService';

const COMMANDS = {
  generate: { fn: regenerateForecast, perm: 'budgets.update' },
  submit: { fn: submitForecastForReview, perm: 'budgets.update' },
  approve: { fn: approveForecast, perm: 'budgets.approve' },
  activate: { fn: activateForecast, perm: 'budgets.approve' },
  lock: { fn: lockForecast, perm: 'budgets.approve' },
  archive: { fn: archiveForecast, perm: 'budgets.update' },
};

export async function POST(request, { params }) {
  const body = await request.json().catch(() => ({}));
  if (body.status) {
    return NextResponse.json(
      { error: 'Direct status mutation is not allowed', code: 'STATUS_MUTATION_FORBIDDEN' },
      { status: 400 }
    );
  }

  const command = body.command || body.action;
  const entry = COMMANDS[command];
  if (!entry) {
    return NextResponse.json({ error: 'Unknown command' }, { status: 400 });
  }

  return withBudgetForecastAuth(request, entry.perm, async (user) => {
    const { id } = await params;
    const data = await entry.fn(user.tenantId, user.id, id, body);
    return NextResponse.json({ success: true, data });
  });
}
