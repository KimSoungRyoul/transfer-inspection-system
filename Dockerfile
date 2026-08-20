# syntax=docker/dockerfile:1
#
# 준공 이관검사 시스템 — Next.js 15 (standalone) + Prisma
#
#  deps     : 의존성 설치
#  builder  : prisma generate + next build
#  migrator : 마이그레이션·시드 전용 (full node_modules, 1회성 실행)
#  runner   : 실제 서비스 이미지 (standalone 출력만 담아 가볍게)

ARG NODE_IMAGE=node:22-alpine

# ── deps ──────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── builder ───────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* 는 번들에 박히므로 빌드 시점에 받아야 한다
ARG NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=""
ARG NEXT_PUBLIC_NAVER_MAP_KEY_PARAM="ncpKeyId"
ARG NEXT_PUBLIC_DEMO_TODAY="2026.07.26"
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=${NEXT_PUBLIC_NAVER_MAP_CLIENT_ID} \
    NEXT_PUBLIC_NAVER_MAP_KEY_PARAM=${NEXT_PUBLIC_NAVER_MAP_KEY_PARAM} \
    NEXT_PUBLIC_DEMO_TODAY=${NEXT_PUBLIC_DEMO_TODAY}
# 빌드 시점에는 DB 에 접속하지 않는다. prisma generate 만 수행한다.
RUN npx prisma generate && npm run build:next

# ── migrator ──────────────────────────────────────────────────────
# prisma migrate deploy + seed 를 돌리는 1회성 이미지.
FROM ${NODE_IMAGE} AS migrator
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/lib ./src/lib
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts"]

# ── runner ────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
