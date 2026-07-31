'use client';

import { applyClientConsolePolicy } from '@/lib/clientConsolePolicy';

// Apply as soon as this client module is evaluated (before child effects).
applyClientConsolePolicy();

/** Mount early in the root client layout so browser console is gated. */
export default function ClientConsoleGate() {
  return null;
}
