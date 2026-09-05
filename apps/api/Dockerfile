# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

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


FROM base AS runner

ENV NODE_ENV=production
ENV PORT=4000

WORKDIR /app

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

COPY --from=builder /app/node_modules ./node_modules

COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

COPY --from=builder /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma
COPY --from=builder /app/packages/db/node_modules ./packages/db/node_modules

COPY --from=builder /app/packages/db-prisma8/package.json ./packages/db-prisma8/package.json
COPY --from=builder /app/packages/db-prisma8/dist ./packages/db-prisma8/dist
COPY --from=builder /app/packages/db-prisma8/node_modules ./packages/db-prisma8/node_modules

COPY --from=builder /app/packages/invoice-pdf/package.json ./packages/invoice-pdf/package.json
COPY --from=builder /app/packages/invoice-pdf/dist ./packages/invoice-pdf/dist
COPY --from=builder /app/packages/invoice-pdf/node_modules ./packages/invoice-pdf/node_modules

EXPOSE 4000

CMD ["node", "apps/api/dist/main.js"]
