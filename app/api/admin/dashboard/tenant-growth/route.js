import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { getSubscriptionStatusFromSubscriptions } from '@/lib/subscriptionService';

/**
 * GET /api/admin/dashboard/tenant-growth
 * Query: groupBy=month|year|all, statusFilter=all|active|inactive
 * Returns summary counts and time-series for tenant growth.
 * Active/Inactive use subscription status (same as /insightbooks/tenant-management).
 */
export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const groupBy = searchParams.get('groupBy') || 'month'; // month | year | all
    const statusFilter = searchParams.get('statusFilter') || 'all'; // all | active | inactive

    const now = new Date();
    const startDate = new Date(now.getFullYear() - 2, 0, 1); // 2 years back for series (ignored when groupBy=all)

    // Fetch all tenants with subscriptions (one source of truth for summary + time series)
    const allTenants = await prisma.tenant.findMany({
      select: {
        id: true,
        status: true,
        createdAt: true,
        accountSubscriptions: {
          select: {
            isTrial: true,
            isActive: true,
            status: true,
            trialEndDate: true,
            expiresAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Summary: use subscription status (match tenant-management: active = paid active, inactive = no active sub or expired)
    let totalTenants = 0;
    let activeTenants = 0;
    let inactiveTenants = 0;
    let paidCount = 0;
    let trialCount = 0;
    for (const t of allTenants) {
      const subStatus = getSubscriptionStatusFromSubscriptions(t.accountSubscriptions, now);
      totalTenants += 1;
      if (subStatus === 'active') {
        activeTenants += 1;
        paidCount += 1;
      } else if (subStatus === 'trial') {
        trialCount += 1;
      } else {
        inactiveTenants += 1; // 'inactive' or 'expired'
      }
    }

    // Time series: filter by date when not groupBy=all
    const tenants = groupBy === 'all' ? allTenants : allTenants.filter((t) => t.createdAt >= startDate);

    const periodKey = (d) => {
      if (groupBy === 'all') return 'all';
      const date = d instanceof Date ? d : new Date(d);
      if (groupBy === 'year') {
        return `${date.getFullYear()}`;
      }
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    };

    const periodLabel = (key) => {
      if (groupBy === 'all' || key === 'all') return 'All';
      if (groupBy === 'year') return key;
      const parts = key.split('-');
      const y = parts[0] || '';
      const m = parts[1] || '1';
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const mi = Math.max(0, Math.min(11, parseInt(m, 10) - 1));
      return `${monthNames[mi]} ${y}`;
    };

    const map = new Map(); // key -> { period, label, all, active, inactive, paid, trial }

    for (const t of tenants) {
      const key = periodKey(t.createdAt);
      if (!map.has(key)) {
        map.set(key, {
          period: key,
          label: periodLabel(key),
          all: 0,
          active: 0,
          inactive: 0,
          paid: 0,
          trial: 0,
        });
      }
      const row = map.get(key);
      row.all += 1;
      const subStatus = getSubscriptionStatusFromSubscriptions(t.accountSubscriptions, now);
      if (subStatus === 'active') {
        row.active += 1;
        row.paid += 1;
      } else if (subStatus === 'trial') {
        row.trial += 1;
      } else {
        row.inactive += 1; // 'inactive' or 'expired'
      }
    }

    // Sort and add cumulative total (running sum of new signups)
    const sortedKeys = groupBy === 'all' ? Array.from(map.keys()) : Array.from(map.keys()).sort();
    let runningTotal = 0;
    const timeSeries = sortedKeys.map((k) => {
      const row = map.get(k);
      runningTotal += row.all;
      return { ...row, cumulativeTotal: runningTotal };
    });

    return NextResponse.json({
      success: true,
      summary: {
        total: totalTenants,
        active: activeTenants,
        inactive: inactiveTenants,
        paid: paidCount,
        trial: trialCount,
      },
      timeSeries,
      groupBy,
      statusFilter,
    });
  } catch (error) {
    console.error('Tenant growth API error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch tenant growth' },
      { status: 500 }
    );
  }
}
