/** In-process counters (Phase 6). No secret values or high-cardinality labels. */

const counters = Object.create(null);

export function incSecurityMetric(name, by = 1) {
  counters[name] = (counters[name] || 0) + by;
}

export function getSecurityMetricsSnapshot() {
  return { ...counters };
}

export function resetSecurityMetricsForTests() {
  for (const k of Object.keys(counters)) delete counters[k];
}
