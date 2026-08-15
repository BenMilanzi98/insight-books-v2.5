import { describe, expect, it } from 'vitest';
import {
  sortOutboxForPush,
  nextPushItem,
  canPullSnapshot,
  markPushFailure,
  markPushSuccess,
} from '../../lib/desktop/outboxState.js';

const rows = [
  { id: 'a', seq: 1, status: 'pending' },
  { id: 'b', seq: 2, status: 'pending' },
  { id: 'c', seq: 3, status: 'pending' },
];

describe('outbox push order', () => {
  it('pushes lowest seq first', () => {
    expect(nextPushItem(rows).id).toBe('a');
  });

  it('retries syncing before later pending', () => {
    const r = [
      { id: 'a', seq: 1, status: 'syncing' },
      { id: 'b', seq: 2, status: 'pending' },
    ];
    expect(nextPushItem(r).id).toBe('a');
  });

  it('stops when an earlier item failed', () => {
    let r = markPushSuccess(rows, 'a', 'srv-a');
    const failed = markPushFailure(r, 'b', 'stock 0');
    expect(failed.find((x) => x.id === 'b').status).toBe('failed');
    expect(failed.find((x) => x.id === 'c').status).toBe('pending');
    expect(nextPushItem(failed)).toBeNull();
    expect(canPullSnapshot(failed)).toBe(false);
  });

  it('allows snapshot pull only when drained', () => {
    let r = markPushSuccess(rows, 'a', 'srv-a');
    r = markPushSuccess(r, 'b', 'srv-b');
    r = markPushSuccess(r, 'c', 'srv-c');
    expect(canPullSnapshot(r)).toBe(true);
  });

  it('allows snapshot pull when outbox is empty', () => {
    expect(canPullSnapshot([])).toBe(true);
  });

  it('sorts by seq even if inserted out of order', () => {
    const mixed = [
      { id: 'c', seq: 3, status: 'pending' },
      { id: 'a', seq: 1, status: 'pending' },
    ];
    expect(sortOutboxForPush(mixed).map((x) => x.id)).toEqual(['a', 'c']);
  });
});
