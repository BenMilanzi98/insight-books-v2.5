// lib/puppeteer-launch.js
// Shared Puppeteer settings for server-side PDFs (invoices, quotations, receipts, payslips).
import fs from 'fs';
import puppeteer from 'puppeteer';

const LINUX_CHROME_CANDIDATES = [
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome-stable',
  '/snap/bin/chromium',
];

/**
 * Prefer system Chrome/Chromium on Linux servers (bundled Chromium often lacks OS libs).
 * Override with PUPPETE_EXECUTABLE_PATH, CHROME_BIN, or GOOGLE_CHROME_BIN.
 */
export function resolveChromeExecutablePath() {
  const fromEnv =
    process.env.PUPPETE_EXECUTABLE_PATH ||
    process.env.CHROME_BIN ||
    process.env.GOOGLE_CHROME_BIN;
  if (fromEnv) {
    try {
      if (fs.existsSync(fromEnv)) return fromEnv;
    } catch {
      /* ignore */
    }
    return fromEnv;
  }
  for (const p of LINUX_CHROME_CANDIDATES) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

export function getPuppeteerLaunchOptions() {
  const executablePath = resolveChromeExecutablePath();
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor',
    '--run-all-compositor-stages-before-draw',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
  ];
  return {
    headless: true,
    args,
    ...(executablePath ? { executablePath } : {}),
  };
}

export async function launchPuppeteer() {
  return puppeteer.launch(getPuppeteerLaunchOptions());
}

/**
 * Prefer over networkidle0: static HTML + optional remote logos won't hang the PDF route.
 */
export const PDF_SET_CONTENT_OPTIONS = {
  waitUntil: 'load',
  timeout: 60000,
};
