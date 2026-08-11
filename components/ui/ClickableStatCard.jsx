'use client';

import StatCard from '@/components/ui/StatCard';

/**
 * Shared clickable KPI / summary card (expenses / invoice style).
 * Thin wrapper over StatCard interactive mode.
 */
export default function ClickableStatCard(props) {
  return <StatCard interactive {...props} />;
}
