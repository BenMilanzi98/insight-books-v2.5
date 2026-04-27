/**
 * Align MobileAppConfig.latestVersionCode / latestVersionName with insight_books_android pubspec.
 * Run from repo root: node scripts/sync-mobile-app-version-code.js
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

function readPubspecVersion() {
  const pubspecPath = path.join(__dirname, '../insight_books_android/pubspec.yaml');
  const pub = fs.readFileSync(pubspecPath, 'utf8');
  const m = pub.match(/^\s*version:\s*([\w.]+)\+(\d+)\s*(?:#.*)?$/m);
  if (!m) {
    throw new Error(`Could not parse version: x.y.z+N from ${pubspecPath}`);
  }
  return { name: m[1], build: parseInt(m[2], 10) };
}

async function main() {
  const { name, build } = readPubspecVersion();
  const prisma = new PrismaClient();
  try {
    await prisma.mobileAppConfig.upsert({
      where: { id: 'global' },
      update: {
        latestVersionCode: build,
        latestVersionName: name,
        publishedAt: new Date(),
      },
      create: {
        id: 'global',
        latestVersionCode: build,
        latestVersionName: name,
      },
    });
    console.log(`MobileAppConfig OK: latestVersionCode=${build}, latestVersionName=${name}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
