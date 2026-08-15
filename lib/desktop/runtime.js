export const DESKTOP_COOKIE = 'ib_desktop';

export function isDesktopRuntime() {
  return process.env.DESKTOP_RUNTIME === '1';
}

export function isDesktopCookie(value) {
  return String(value || '') === '1';
}
