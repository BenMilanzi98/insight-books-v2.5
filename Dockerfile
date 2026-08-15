# Multi-stage Dockerfile tuned for small VPS hosts (~2 GB RAM).
# Prefer: build the image on a larger machine / CI, then pull+run on the VPS.
# On-box `docker compose build` needs ~2G swap (see scripts/vps-ensure-swap.sh).

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Builder (low parallelism / capped heap)
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY prisma ./prisma

ENV NEXT_TELEMETRY_DISABLED=1
ENV UV_THREADPOOL_SIZE=1
# Cap Node heap so webpack + OS fit on a 2 GB host with swap.
ENV NODE_OPTIONS=--max-old-space-size=1280

RUN npm run db:generate
# Do not use standalone here — file tracing peaks RAM hard on small boxes.
RUN npm run build:vps
RUN npm ci --omit=dev

# Stage 3: Production (next start — matches VPS release path)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Keep runtime heap modest so Postgres + Node coexist on 2 GB.
ENV NODE_OPTIONS=--max-old-space-size=512

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.mjs ./next.config.mjs
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/ || exit 1

CMD ["npx", "next", "start", "-p", "3000"]
