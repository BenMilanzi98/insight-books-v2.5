/**
 * Failure-injection framework — must be unavailable outside QA test mode.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isFailureInjectionEnabled,
  armFailure,
  clearFailures,
  maybeFail,
  listFailurePoints,
} from '../../../lib/qa/failureInjection.js';

describe('Failure injection (Phase 16)', () => {
  const prevNode = process.env.NODE_ENV;
  const prevFlag = process.env.QA_FAILURE_INJECTION;

  beforeEach(() => {
    clearFailures();
  });

  afterEach(() => {
    clearFailures();
    process.env.NODE_ENV = prevNode;
    if (prevFlag === undefined) delete process.env.QA_FAILURE_INJECTION;
    else process.env.QA_FAILURE_INJECTION = prevFlag;
  });

  it('lists known injection points', () => {
    expect(listFailurePoints()).toContain('BEFORE_COMMIT');
    expect(listFailurePoints()).toContain('AFTER_OUTBOX');
  });

  it('is disabled when QA_FAILURE_INJECTION is not set (production-safe)', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.QA_FAILURE_INJECTION;
    expect(isFailureInjectionEnabled()).toBe(false);
    expect(armFailure('BEFORE_COMMIT')).toBe(false);
    expect(() => maybeFail('BEFORE_COMMIT')).not.toThrow();
  });

  it('is disabled in test without explicit flag', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.QA_FAILURE_INJECTION;
    expect(isFailureInjectionEnabled()).toBe(false);
    expect(armFailure('BEFORE_COMMIT')).toBe(false);
  });

  it('arms and fires once when enabled', () => {
    process.env.NODE_ENV = 'test';
    process.env.QA_FAILURE_INJECTION = '1';
    expect(isFailureInjectionEnabled()).toBe(true);
    expect(armFailure('BEFORE_COMMIT', { message: 'boom' })).toBe(true);
    expect(() => maybeFail('BEFORE_COMMIT')).toThrow(/boom/);
    // second call does not throw (one-shot)
    expect(() => maybeFail('BEFORE_COMMIT')).not.toThrow();
  });

  it('rejects unknown points when enabled', () => {
    process.env.NODE_ENV = 'test';
    process.env.QA_FAILURE_INJECTION = '1';
    expect(() => armFailure('NOT_A_REAL_POINT')).toThrow(/Unknown/);
  });
});
