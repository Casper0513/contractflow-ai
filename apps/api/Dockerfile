# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable \
    && apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app


FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/db-prisma8/package.json packages/db-prisma8/package.json
COPY packages/invoice-pdf/package.json packages/invoice-pdf/package.json

RUN pnpm install --frozen-lockfile


FROM deps AS builder

ARG DATABASE_URL=postgresql://contractflow:contractflow@localhost:5432/contractflow?schema=public
ENV DATABASE_URL="$DATABASE_URL"

COPY . .

RUN pnpm db:generate

RUN pnpm --filter @contractflow/db build
RUN pnpm --filter @contractflow/db-prisma8 build
RUN pnpm --filter @contractflow/invoice-pdf build
RUN pnpm --filter @contractflow/api build

RUN pnpm --filter @contractflow/api deploy \
    --prod \
    --legacy \
    /prod/api


FROM base AS runner

ENV NODE_ENV=production
ENV PORT=4000

WORKDIR /app

COPY --from=builder /prod/api /app

USER node

EXPOSE 4000

CMD ["sh", "-c", "cd /app/node_modules/@contractflow/db && ./node_modules/.bin/prisma migrate deploy && cd /app && exec node dist/main.js"]
