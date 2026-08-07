# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION} AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY libs/common/package.json libs/common/
COPY libs/redis/package.json libs/redis/
COPY libs/messaging/package.json libs/messaging/
COPY apps/auth-service/package.json apps/auth-service/
COPY apps/api-gateway/package.json apps/api-gateway/
COPY apps/patient-service/package.json apps/patient-service/
COPY apps/doctor-service/package.json apps/doctor-service/
COPY apps/appointment-service/package.json apps/appointment-service/
COPY apps/notification-service/package.json apps/notification-service/
COPY apps/worker/package.json apps/worker/
RUN pnpm install --frozen-lockfile

FROM deps AS build
ARG APP_NAME
COPY tsconfig.base.json tsconfig.json ./
COPY proto proto
COPY libs/common libs/common
COPY libs/redis libs/redis
COPY libs/messaging libs/messaging
COPY apps/${APP_NAME} apps/${APP_NAME}
RUN pnpm --filter @healthflow/common build \
  && pnpm --filter @healthflow/redis build \
  && pnpm --filter @healthflow/messaging build \
  && pnpm --filter @healthflow/${APP_NAME} prisma:generate || true \
  && pnpm --filter @healthflow/${APP_NAME} build

FROM node:${NODE_VERSION} AS runner
ARG APP_NAME
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate \
  && addgroup -S healthflow && adduser -S healthflow -G healthflow
WORKDIR /app
ENV NODE_ENV=production
ENV APP_NAME=${APP_NAME}

COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/.npmrc ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/proto ./proto
COPY --from=build /app/libs/common ./libs/common
COPY --from=build /app/libs/redis ./libs/redis
COPY --from=build /app/libs/messaging ./libs/messaging
COPY --from=build /app/apps/${APP_NAME} ./apps/${APP_NAME}

USER healthflow
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-c", "node apps/${APP_NAME}/dist/main.js"]
