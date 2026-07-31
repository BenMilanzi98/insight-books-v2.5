import { buildSegmentsAnalyticsPack } from '@/lib/admin/revenue';
import { handleWave4RevenueGet } from '@/lib/admin/revenue/wave4Route.js';

export async function GET(request) {
  return handleWave4RevenueGet(request, buildSegmentsAnalyticsPack, 'revenue segments pack');
}
