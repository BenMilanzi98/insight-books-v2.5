const { app, BrowserWindow, ipcMain, session, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { randomUUID } = require('crypto');
const { pathToFileURL } = require('url');

const { runDesktopSyncFromMain } = require('./runSync.cjs');

const CLOUD_URL = (process.env.DESKTOP_CLOUD_URL || 'https://app.insightbooks.co').replace(/\/$/, '');
const LOCAL_PORT = Number(process.env.DESKTOP_PORT || 3791);
const LOCAL_ORIGIN = `http://127.0.0.1:${LOCAL_PORT}`;
const SYNC_INTERVAL_MS = 15 * 60 * 1000;

let mainWindow = null;
let nextProcess = null;
let syncTimer = null;
let sessionCookieValue = null;

const CLOUD_ORIGIN = new URL(CLOUD_URL).origin;
const AUTH_PATHS = new Set(['/auth/login', '/auth/signup']);
const SETUP_PATH = '/desktop/setup';

function libDesktopRoot() {
  const packagedRoot = path.join(__dirname, 'lib', 'desktop');
  if (fs.existsSync(packagedRoot)) return packagedRoot;
  return path.join(__dirname, '..', 'lib', 'desktop');
}

function importLibDesktop(relativePath) {
  return import(pathToFileURL(path.join(libDesktopRoot(), relativePath)).href);
}

function paths() {
  const userData = app.getPath('userData');
  return {
    userData,
    sqlitePath: path.join(userData, 'desktop.sqlite'),
    devicePath: path.join(userData, 'device.json'),
    sessionPath: path.join(userData, 'session.json'),
    schemaPath: path.join(libDesktopRoot(), 'sqlite', 'schema.sql'),
  };
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function loadOrCreateDeviceId(devicePath) {
  const existing = readJson(devicePath);
  if (existing?.deviceId) return existing.deviceId;
  const deviceId = randomUUID();
  writeJson(devicePath, { deviceId });
  return deviceId;
}

function loadSessionCookie(sessionPath) {
  const data = readJson(sessionPath);
  sessionCookieValue = data?.session || null;
  return sessionCookieValue;
}

function saveSessionCookie(sessionPath, cookie) {
  sessionCookieValue = cookie;
  writeJson(sessionPath, { session: cookie });
}

async function openDb(sqlitePath) {
  const { openDesktopDb } = await importLibDesktop('sqlite/db.js');
  return openDesktopDb(sqlitePath);
}

async function readTenantIdFromMeta(db) {
  const { readMeta } = await importLibDesktop('sqlite/meta.js');
  const meta = readMeta(db);
  return meta.tenantId || null;
}

async function isDeviceBound(p) {
  if (!fs.existsSync(p.sqlitePath)) return false;
  let db;
  try {
    db = await openDb(p.sqlitePath);
    return Boolean(await readTenantIdFromMeta(db));
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

function waitForHttp(url, { timeoutMs = 120000, intervalMs = 500 } = {}) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      fetch(url, { method: 'GET' })
        .then(() => resolve())
        .catch(() => {
          if (Date.now() - started > timeoutMs) {
            reject(new Error(`Timed out waiting for ${url}`));
            return;
          }
          setTimeout(tick, intervalMs);
        });
    };
    tick();
  });
}

function getStandaloneDir() {
  if (process.env.DESKTOP_STANDALONE_PATH) {
    return process.env.DESKTOP_STANDALONE_PATH;
  }
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'standalone');
  }
  return path.join(__dirname, '..', '.next', 'standalone');
}

function spawnLocalNext(p) {
  const standaloneDir = getStandaloneDir();
  const serverJs = path.join(standaloneDir, 'server.js');
  if (!fs.existsSync(serverJs)) {
    throw new Error(`Standalone server not found at ${serverJs}. Run npm run build:standalone first.`);
  }

  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    DESKTOP_RUNTIME: '1',
    PORT: String(LOCAL_PORT),
    HOSTNAME: '127.0.0.1',
    DESKTOP_SQLITE_PATH: p.sqlitePath,
    DESKTOP_CLOUD_URL: CLOUD_URL,
  };

  nextProcess = spawn(process.execPath, [serverJs], {
    cwd: standaloneDir,
    env,
    stdio: 'inherit',
  });

  nextProcess.on('exit', (code) => {
    if (code != null && code !== 0) {
      console.error(`Local Next server exited with code ${code}`);
    }
  });
}

function stopLocalNext() {
  if (nextProcess) {
    nextProcess.kill();
    nextProcess = null;
  }
}

async function setDesktopCookieOnLocalOrigin() {
  const ses = session.defaultSession;
  await ses.cookies.set({
    url: LOCAL_ORIGIN,
    name: 'ib_desktop',
    value: '1',
    path: '/',
  });
  if (sessionCookieValue) {
    await ses.cookies.set({
      url: LOCAL_ORIGIN,
      name: 'session',
      value: sessionCookieValue,
      path: '/',
    });
  }
}

async function loadLocalApp(win, p) {
  spawnLocalNext(p);
  await waitForHttp(LOCAL_ORIGIN);
  await setDesktopCookieOnLocalOrigin();
  win.loadURL(LOCAL_ORIGIN);
}

function loadCloudSetup(win, deviceId) {
  const setupUrl = `${CLOUD_URL}/desktop/setup?deviceId=${encodeURIComponent(deviceId)}`;
  win.loadURL(setupUrl);
}

function loadCloudLogin(win) {
  win.loadURL(`${CLOUD_URL}/auth/login?desktop=1`);
}

async function maybeRedirectUnboundToSetup(win, p, deviceId, url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }
  if (parsed.origin !== CLOUD_ORIGIN) return;

  const pathname = parsed.pathname.replace(/\/$/, '') || '/';
  if (AUTH_PATHS.has(pathname)) return;
  if (pathname === SETUP_PATH || pathname.startsWith(`${SETUP_PATH}/`)) return;
  if (await isDeviceBound(p)) return;

  loadCloudSetup(win, deviceId);
}

function attachUnboundNavigationHandlers(win, p, deviceId) {
  const handler = (_event, url) => {
    maybeRedirectUnboundToSetup(win, p, deviceId, url).catch((err) => {
      console.warn('Setup redirect failed:', err?.message || err);
    });
  };
  win.webContents.on('did-navigate', handler);
  win.webContents.on('did-navigate-in-page', handler);
}

async function importSnapshot(p, { snapshot, sessionCookie, bindMeta, deviceId }) {
  const { assertSetupSnapshot } = await importLibDesktop('setupPayload.js');
  const { replaceSnapshot } = await importLibDesktop('sqlite/snapshotStore.js');
  const { writeMeta } = await importLibDesktop('sqlite/meta.js');

  assertSetupSnapshot(snapshot);

  const db = await openDb(p.sqlitePath);
  try {
    replaceSnapshot(db, snapshot);
    writeMeta(db, {
      tenantId: snapshot.tenantId,
      deviceId,
      numberPrefix: bindMeta?.numberPrefix || '',
      boundAt: bindMeta?.boundAt ? String(new Date(bindMeta.boundAt).getTime()) : String(Date.now()),
      subscriptionActive: 'true',
    });
  } finally {
    db.close();
  }

  if (sessionCookie) {
    saveSessionCookie(p.sessionPath, sessionCookie);
  }
}

async function runSyncIfOnline(p) {
  if (!sessionCookieValue || !fs.existsSync(p.sqlitePath)) return;
  if (net?.online === false) return;

  try {
    await runDesktopSyncFromMain({
      sqlitePath: p.sqlitePath,
      cloudUrl: CLOUD_URL,
      sessionCookie: sessionCookieValue,
    });
  } catch (err) {
    console.warn('Desktop sync failed:', err?.message || err);
  }
}

function scheduleSync(p) {
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = setInterval(() => {
    runSyncIfOnline(p);
  }, SYNC_INTERVAL_MS);
}

async function unbindAndReset(p, win) {
  if (sessionCookieValue) {
    let deviceId = readJson(p.devicePath)?.deviceId;
    try {
      await fetch(`${CLOUD_URL}/api/desktop/unbind`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookieValue}`,
        },
        body: JSON.stringify({ deviceId }),
      });
    } catch (err) {
      console.warn('Cloud unbind failed:', err?.message || err);
    }
  }

  stopLocalNext();
  if (fs.existsSync(p.sqlitePath)) fs.unlinkSync(p.sqlitePath);
  if (fs.existsSync(p.sessionPath)) fs.unlinkSync(p.sessionPath);
  sessionCookieValue = null;

  const deviceId = loadOrCreateDeviceId(p.devicePath);
  loadCloudLogin(win);
  return deviceId;
}

async function createWindow() {
  const p = paths();
  const deviceId = loadOrCreateDeviceId(p.devicePath);
  loadSessionCookie(p.sessionPath);

  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow = win;

  ipcMain.handle('desktop:getDeviceId', () => deviceId);

  ipcMain.handle('desktop:finishSetup', async (_event, payload) => {
    await importSnapshot(p, {
      snapshot: payload.snapshot,
      sessionCookie: payload.sessionCookie,
      bindMeta: payload.bindMeta,
      deviceId,
    });
    await loadLocalApp(win, p);
    scheduleSync(p);
    runSyncIfOnline(p);
    return { ok: true };
  });

  ipcMain.handle('desktop:unbind', async () => {
    const nextDeviceId = await unbindAndReset(p, win);
    return { ok: true, deviceId: nextDeviceId };
  });

  if (await isDeviceBound(p)) {
    loadLocalApp(win, p).catch((err) => {
      console.error(err);
      loadCloudSetup(win, deviceId);
    });
    scheduleSync(p);
    runSyncIfOnline(p);
  } else {
    attachUnboundNavigationHandlers(win, p, deviceId);
    loadCloudLogin(win);
  }

  return win;
}

app.whenReady().then(async () => {
  await createWindow();

  app.on('browser-window-created', () => {
    runSyncIfOnline(paths());
  });

  if (net?.on) {
    net.on('online', () => runSyncIfOnline(paths()));
  }

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });
});

app.on('window-all-closed', () => {
  stopLocalNext();
  if (syncTimer) clearInterval(syncTimer);
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopLocalNext();
  if (syncTimer) clearInterval(syncTimer);
});

module.exports = { unbindAndReset };
