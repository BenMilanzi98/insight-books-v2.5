/** Format a KPI envelope value for display — never invents zeroes. */

export function formatMetricValue(metric) {
  if (metric == null) return null;
  if (metric.value == null) return null;
  if (metric.masked) return '••••';
  const { value, unit, currency } = metric;
  if (unit === 'money') {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return `${currency || 'MWK'} ${n.toLocaleString()}`;
  }
  if (unit === 'seconds') {
    const sec = Number(value);
    if (!Number.isFinite(sec)) return null;
    if (sec < 60) return `${sec}s lag`;
    if (sec < 3600) return `${Math.round(sec / 60)}m lag`;
    return `${Math.round(sec / 3600)}h lag`;
  }
  if (unit === 'status' && typeof value === 'object') {
    return `${value.memoryRssMb ?? '—'} MB RSS`;
  }
  if (typeof value === 'object') return JSON.stringify(value);
  const n = Number(value);
  if (Number.isFinite(n)) return n.toLocaleString();
  return String(value);
}
