# Образ для Amvera (и любого Docker-хостинга): Next.js standalone + миграции и сид при старте.
# Секреты (DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL) передаются переменными окружения при запуске.

FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:24-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Заглушки нужны только чтобы модули импортировались при сборке; к БД сборка не подключается, в образ они не попадают.
RUN DATABASE_URL=postgres://build:build@127.0.0.1:5432/build BETTER_AUTH_SECRET=build-time-placeholder-not-a-secret npm run build
# Скрипт старта (миграции + сид при пустой базе) собираем в один JS-файл.
RUN npx esbuild scripts/start-seed.ts scripts/reset.ts --bundle --platform=node --target=node24 --format=cjs \
      --outdir=dist --out-extension:.js=.cjs --external:@node-rs/argon2 --external:pg

FROM node:24-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
# 1) миграции; 2) сид, если база пустая (или полный сброс при DEMO_RESET_ON_START=1); 3) сервер.
CMD ["sh", "-c", "node dist/start-seed.cjs && exec node server.js"]
