import { join } from 'node:path';

export function getDesktopSqlitePath() {
  if (process.env.DESKTOP_SQLITE_PATH) {
    return process.env.DESKTOP_SQLITE_PATH;
  }
  return join(process.env.APPDATA || '', 'InsightBooks', 'desktop.sqlite');
}
