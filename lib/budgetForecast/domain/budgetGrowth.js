/**
 * Per-account budget growth modes for forward projection within a budget period.
 */

export const BUDGET_GROWTH_MODES = Object.freeze({
  MANUAL: 'MANUAL',
  GROWTH_PERCENT: 'GROWTH_PERCENT',
  GROWTH_FIXED: 'GROWTH_FIXED',
});

/**
 * @param {number} anchorAmount first period amount (major units)
 * @param {number} periodCount
 * @param {{ mode: string, growthPercent?: number, fixedIncrement?: number }} settings
 * @returns {number[]}
 */
export function applyGrowthSeries(anchorAmount, periodCount, settings) {
  const mode = String(settings?.mode || BUDGET_GROWTH_MODES.MANUAL).toUpperCase();
  const n = Math.max(1, Number(periodCount) || 1);
  const growthPercent = Number(settings?.growthPercent) || 0;
  const fixedIncrement = Number(settings?.fixedIncrement) || 0;

  const amounts = [];
  let current = Number(anchorAmount) || 0;

  for (let i = 0; i < n; i += 1) {
    if (i === 0) {
      amounts.push(Math.round(current * 100) / 100);
    } else if (mode === BUDGET_GROWTH_MODES.GROWTH_PERCENT) {
      current = current * (1 + growthPercent / 100);
      amounts.push(Math.round(current * 100) / 100);
    } else if (mode === BUDGET_GROWTH_MODES.GROWTH_FIXED) {
      current = current + fixedIncrement;
      amounts.push(Math.round(current * 100) / 100);
    } else {
      amounts.push(Math.round(current * 100) / 100);
    }
  }

  return amounts;
}

/**
 * Map period keys to growth-applied amounts from an anchor in the first period.
 * @param {string[]} periodKeys
 * @param {Record<string, string|number>} existingAmounts
 * @param {{ mode: string, growthPercent?: number, fixedIncrement?: number }} settings
 */
export function applyGrowthToPeriodMap(periodKeys, existingAmounts, settings) {
  const anchor = Number(existingAmounts[periodKeys[0]]) || 0;
  const series = applyGrowthSeries(anchor, periodKeys.length, settings);
  const next = {};
  periodKeys.forEach((key, i) => {
    next[key] = String(series[i]);
  });
  return next;
}

export function parseLineGrowthAssumptions(assumptions) {
  if (!assumptions) return { mode: BUDGET_GROWTH_MODES.MANUAL, growthPercent: 0, fixedIncrement: 0 };
  try {
    const parsed = typeof assumptions === 'string' ? JSON.parse(assumptions) : assumptions;
    return {
      mode: parsed.mode || BUDGET_GROWTH_MODES.MANUAL,
      growthPercent: Number(parsed.growthPercent) || 0,
      fixedIncrement: Number(parsed.fixedIncrement) || 0,
    };
  } catch {
    return { mode: BUDGET_GROWTH_MODES.MANUAL, growthPercent: 0, fixedIncrement: 0 };
  }
}

export function serializeLineGrowthAssumptions(settings) {
  return JSON.stringify({
    mode: settings.mode || BUDGET_GROWTH_MODES.MANUAL,
    growthPercent: Number(settings.growthPercent) || 0,
    fixedIncrement: Number(settings.fixedIncrement) || 0,
  });
}
