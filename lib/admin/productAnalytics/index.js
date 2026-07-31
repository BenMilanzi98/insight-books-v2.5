export * from './catalogue.js';
export * from './reliabilityGate.js';
export * from './authz.js';
export * from './producers.js';
export * from './facts.js';
export * from './firstValue.js';
export * from './repeatValue.js';
export * from './activation.js';
export * from './adoption.js';
export * from './overview.js';
export * from './funnels.js';
export * from './cohorts.js';
export * from './signals.js';
export * from './reconcile.js';
export * from './export.js';

// Convenience re-exports for permission / nav assertions in tests & callers
export {
  SYSTEM_ADMIN_PERMISSIONS,
  NAV_PERMISSION_MAP,
} from '@/lib/admin/permissions';
