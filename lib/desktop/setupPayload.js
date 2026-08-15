export function assertSetupSnapshot(snapshot) {
  if (!snapshot || snapshot.version !== 1 || !snapshot.tenantId) {
    throw new Error('Invalid snapshot');
  }
  return true;
}
