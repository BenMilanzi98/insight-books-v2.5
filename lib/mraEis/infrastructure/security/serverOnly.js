/** Fail closed if imported into a browser bundle. */
export function assertServerOnly(moduleName = 'mraEis/security') {
  if (typeof window !== 'undefined') {
    throw new Error(`${moduleName} is server-only and must not load in the browser.`);
  }
}

assertServerOnly('mraEis/security/serverOnly');
