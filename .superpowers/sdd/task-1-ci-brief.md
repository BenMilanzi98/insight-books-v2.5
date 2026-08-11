### Task 1: next.config tracing + optimizePackageImports

**Files:**
- Modify: `next.config.mjs`

**Interfaces:**
- Consumes: existing `outputFileTracingExcludes` and `experimental` blocks
- Produces: wider excludes + `experimental.optimizePackageImports`

- [ ] **Step 1: Update `outputFileTracingExcludes` and `experimental`**

In `next.config.mjs`, replace the `outputFileTracingExcludes` and `experimental` sections with:

```js
  outputFileTracingExcludes: {
    '*': [
      './uploads/**/*',
      './tmp/**/*',
      './.cursor/**/*',
      './docs/**/*',
      './storage/**/*',
      './insight/**/*',
      './android-app-center/**/*',
      './insight_books_android/**/*',
      './starter-for-nextjs/**/*',
      './test/**/*',
      './tests/**/*',
      './artifacts/**/*',
      './backups/**/*',
      './node_modules/@swc/core*/**/*',
      './node_modules/next/dist/server/lib/squoosh/**/*',
      './**/*.docx',
      './**/*.pdf',
      './**/*.xlsx',
    ],
  },
  transpilePackages: ['qrcode.react'],
  productionBrowserSourceMaps: false,
  experimental: {
    // Lower peak memory during webpack production builds (helps small VPSs).
    webpackMemoryOptimizations: true,
    cpus: 1,
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
```

Keep all other existing keys (`turbopack`, `compiler`, standalone spread, `webpack`, `images`, `headers`, `serverExternalPackages`, `generateBuildId`, `redirects`) unchanged.

- [ ] **Step 2: Syntax-check the config**

Run:

```bash
node --check next.config.mjs
```

Expected: exit code 0, no output.

- [ ] **Step 3: Commit**

Skip unless the user explicitly asks to commit.

---

