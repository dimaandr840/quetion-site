# syntax=docker/dockerfile:1.7
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
ENV NPM_CONFIG_FETCH_RETRIES=5 NPM_CONFIG_FETCH_TIMEOUT=600000
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

FROM node:24-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_AUTH_ENABLED=true
ARG NEXT_PUBLIC_SITE_URL=http://localhost
ARG NEXT_PUBLIC_MEDIA_BASE_URL
# Номер счётчика Яндекс Метрики. Пусто = аналитика не подключается вовсе.
ARG NEXT_PUBLIC_YM_ID
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_AUTH_ENABLED=$NEXT_PUBLIC_AUTH_ENABLED \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_MEDIA_BASE_URL=$NEXT_PUBLIC_MEDIA_BASE_URL \
    NEXT_PUBLIC_YM_ID=$NEXT_PUBLIC_YM_ID
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS run
WORKDIR /app
# HOSTNAME задан явно: server.js из output: "standalone" читает адрес для
# listen из process.env.HOSTNAME, а Docker подставляет туда ID контейнера.
# Без этой переменной сервер слушает только адрес eth0, и проба healthcheck
# на http://127.0.0.1:3000/robots.txt получает connection refused.
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
RUN mkdir -p .next/cache && chown -R nextjs:nodejs .next/cache
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
