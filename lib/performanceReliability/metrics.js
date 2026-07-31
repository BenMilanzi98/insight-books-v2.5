/**
 * Process-local metrics for Phase 17 observability scaffolding.
 * Not a substitute for Prometheus/OpenTelemetry in multi-node production.
 */

const counters = new Map();
const timings = new Map();
const startedAt = Date.now();

export function incr(name, by = 1, labels = {}) {
  const key = metricKey(name, labels);
  counters.set(key, (counters.get(key) || 0) + by);
  return counters.get(key);
}

export function observeMs(name, durationMs, labels = {}) {
  const key = metricKey(name, labels);
  const arr = timings.get(key) || [];
  arr.push(Number(durationMs) || 0);
  if (arr.length > 500) arr.shift();
  timings.set(key, arr);
}

export async function timeAsync(name, fn, labels = {}) {
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    observeMs(name, performance.now() - t0, labels);
  }
}

export function snapshotMetrics() {
  const out = {
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    counters: Object.fromEntries(counters),
    timings: {},
  };
  for (const [k, arr] of timings.entries()) {
    if (!arr.length) continue;
    const sorted = [...arr].sort((a, b) => a - b);
    out.timings[k] = {
      count: sorted.length,
      p50: percentile(sorted, 0.5),
      p95: percentile(sorted, 0.95),
      p99: percentile(sorted, 0.99),
      max: sorted[sorted.length - 1],
    };
  }
  return out;
}

export function resetMetrics() {
  counters.clear();
  timings.clear();
}

function metricKey(name, labels) {
  const parts = Object.keys(labels || {})
    .sort()
    .map((k) => `${k}=${labels[k]}`);
  return parts.length ? `${name}{${parts.join(',')}}` : name;
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
  return Math.round(sorted[idx] * 100) / 100;
}
