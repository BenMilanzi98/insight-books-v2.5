# Fallback Policy

1. Requested ny string if present and not Critical-blocked
2. English same key
3. Generic English message
4. Log missing key (dev warn / prod telemetry)
Never show raw keys in production.
