import { DESKTOP_CODES } from './codes.js';
import { classifyDesktopApiPath } from './paths.js';

export function resolveDesktopApiMiddleware(pathname) {
  const kind = classifyDesktopApiPath(pathname);

  if (kind === 'operational') {
    return {
      action: 'rewrite',
      pathname: `/api/desktop-local${pathname.slice('/api'.length)}`,
    };
  }

  if (kind === 'online-only') {
    return {
      action: 'respond',
      status: 503,
      body: {
        code: DESKTOP_CODES.ONLINE_ONLY,
        error: 'This area needs internet.',
      },
    };
  }

  if (kind === 'desktop-cloud') {
    return {
      action: 'respond',
      status: 404,
      body: { error: 'Not found' },
    };
  }

  return { action: 'next' };
}
