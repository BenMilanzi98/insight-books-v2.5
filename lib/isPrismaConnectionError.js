/**
 * True when Prisma failed to talk to the database (wrong host, DB stopped, firewall, etc.).
 * Used by auth and other routes so clients see 503 instead of a generic 500.
 */
export function isPrismaConnectionError(err) {
  if (!err) return false;
  const code = err.code;
  if (code === 'P1001' || code === 'P1017' || code === 'P1000' || code === 'P1002') return true;
  const msg = String(err.message || '');
  return /Can't reach database server|Server has closed the connection|Timed out fetching/i.test(
    msg
  );
}
