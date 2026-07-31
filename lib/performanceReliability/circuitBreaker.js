/**
 * Simple circuit breaker for non-essential external dependencies.
 * Never wrap canonical financial posting transactions.
 */

const breakers = new Map();

/**
 * @param {string} name
 * @param {{ failureThreshold?: number, recoveryMs?: number }} opts
 */
export function getCircuit(name, opts = {}) {
  if (!breakers.has(name)) {
    breakers.set(name, {
      name,
      state: 'CLOSED',
      failures: 0,
      openedAt: 0,
      failureThreshold: opts.failureThreshold ?? 5,
      recoveryMs: opts.recoveryMs ?? 30_000,
    });
  }
  return breakers.get(name);
}

export function circuitAllow(name, opts = {}) {
  const c = getCircuit(name, opts);
  if (c.state === 'CLOSED') return true;
  if (c.state === 'OPEN') {
    if (Date.now() - c.openedAt >= c.recoveryMs) {
      c.state = 'HALF_OPEN';
      return true;
    }
    return false;
  }
  // HALF_OPEN — allow one probe
  return true;
}

export function circuitSuccess(name) {
  const c = getCircuit(name);
  c.failures = 0;
  c.state = 'CLOSED';
}

export function circuitFailure(name) {
  const c = getCircuit(name);
  c.failures += 1;
  if (c.state === 'HALF_OPEN' || c.failures >= c.failureThreshold) {
    c.state = 'OPEN';
    c.openedAt = Date.now();
  }
}

export function circuitSnapshot() {
  return Object.fromEntries(
    [...breakers.entries()].map(([k, v]) => [
      k,
      { state: v.state, failures: v.failures, openedAt: v.openedAt },
    ])
  );
}

export function _resetCircuits() {
  breakers.clear();
}
