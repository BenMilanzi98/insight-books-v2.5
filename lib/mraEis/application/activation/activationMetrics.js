/**
 * Lightweight activation metrics (in-process counters/gauges).
 * No high-cardinality sensitive labels.
 */

const counters = Object.create(null);
const gauges = Object.create(null);
const histograms = Object.create(null);

export function incActivationMetric(name, by = 1) {
  counters[name] = (counters[name] || 0) + by;
}

export function setActivationGauge(name, value) {
  gauges[name] = value;
}

export function observeActivationHistogram(name, ms) {
  if (!histograms[name]) histograms[name] = [];
  histograms[name].push(Number(ms) || 0);
  if (histograms[name].length > 500) histograms[name].shift();
}

export function getActivationMetricsSnapshot() {
  return {
    counters: { ...counters },
    gauges: { ...gauges },
    histograms: Object.fromEntries(
      Object.entries(histograms).map(([k, arr]) => {
        const sorted = [...arr].sort((a, b) => a - b);
        const p = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))] ?? 0;
        return [k, { count: sorted.length, p50: p(0.5), p95: p(0.95), max: sorted[sorted.length - 1] || 0 }];
      })
    ),
  };
}

export function resetActivationMetricsForTests() {
  for (const k of Object.keys(counters)) delete counters[k];
  for (const k of Object.keys(gauges)) delete gauges[k];
  for (const k of Object.keys(histograms)) delete histograms[k];
}
