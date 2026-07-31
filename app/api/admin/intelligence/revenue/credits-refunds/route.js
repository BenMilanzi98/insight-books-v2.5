import { buildCreditsRefundsAnalyticsPack } from '@/lib/admin/revenue';
import { handleWave3RevenueGet } from '@/lib/admin/revenue/wave3Route.js';

export async function GET(request) {
  return handleWave3RevenueGet(
    request,
    buildCreditsRefundsAnalyticsPack,
    'revenue credits-refunds pack'
  );
}
