"use strict";exports.id=99958,exports.ids=[99958],exports.modules={799958:(a,b,c)=>{c.r(b),c.d(b,{getDesktopDbFromEnv:()=>h,openDesktopDb:()=>g,resetDesktopDbFromEnvForTests:()=>i});var d=c(176760);let e=`
CREATE TABLE IF NOT EXISTS meta (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS snapshot_json (
  entity TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  quantity REAL NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS doc_counters (
  type TEXT PRIMARY KEY,
  lastIssued INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY,
  seq INTEGER NOT NULL UNIQUE,
  createdAt TEXT NOT NULL,
  kind TEXT NOT NULL,
  payloadJson TEXT NOT NULL,
  status TEXT NOT NULL,
  errorMessage TEXT,
  serverId TEXT
);
`.trim(),f=null;function g(a){let b=new(function(){try{return c(487550)}catch(b){let a=b?.message||String(b);throw Error(`better-sqlite3 is required for desktop offline SQLite (${a}). Install build tools and run: npm install better-sqlite3`)}}())(a);return b.exec(e),b}function h(){return f||(f=g(process.env.DESKTOP_SQLITE_PATH?process.env.DESKTOP_SQLITE_PATH:(0,d.join)(process.env.APPDATA||"","InsightBooks","desktop.sqlite")))}function i(){f=null}}};