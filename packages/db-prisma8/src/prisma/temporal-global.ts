import type { Temporal as TemporalPolyfill } from "@js-temporal/polyfill";

/**
 * Prisma 8 RC's PostgreSQL ORM declarations currently reference the
 * Stage 3 Temporal API through the global `Temporal` namespace.
 *
 * Node/TypeScript in ContractFlow uses @js-temporal/polyfill, so expose
 * only the Temporal types Prisma's PostgreSQL adapter requires.
 */
declare global {
  // Prisma 8 RC declarations require the global Temporal namespace.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Temporal {
    type Instant = TemporalPolyfill.Instant;
    type PlainDate = TemporalPolyfill.PlainDate;
    type PlainDateTime = TemporalPolyfill.PlainDateTime;
    type PlainTime = TemporalPolyfill.PlainTime;
  }
}

export {};
