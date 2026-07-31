/**
 * Node ESM resolve hook so CLI scripts can import application modules outside
 * the Next.js build:
 *   - resolves the `@/` path alias to the project root,
 *   - resolves extensionless imports (`./prisma`, `next/headers`) the way the
 *     bundler does, by retrying with `.js` and `/index.js`.
 */

import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const RETRYABLE = new Set(['ERR_MODULE_NOT_FOUND', 'ERR_UNSUPPORTED_DIR_IMPORT']);

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const base = path.join(projectRoot, specifier.slice(2));
    for (const candidate of [base, `${base}.js`, path.join(base, 'index.js')]) {
      if (existsSync(candidate)) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
  }
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (RETRYABLE.has(err?.code) && !path.extname(specifier)) {
      for (const retry of [`${specifier}.js`, `${specifier}/index.js`]) {
        try {
          return await nextResolve(retry, context);
        } catch {
          // fall through to the original error
        }
      }
    }
    throw err;
  }
}
