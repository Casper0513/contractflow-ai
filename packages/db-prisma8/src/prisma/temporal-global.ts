import type { Temporal as TemporalPolyfill } from "@js-temporal/polyfill";

/**
 * Prisma 8 RC's PostgreSQL ORM declarations currently reference the
 * Stage 3 Temporal API through the global `Temporal` namespace.
 *
 * Node/TypeScript in ContractFlow uses @js-temporal/polyfill, so expose
 * only the Temporal types Prisma's PostgreSQL adapter requires.
 *
 * Keep the polyfill aliases outside the global Temporal namespace.
 * This prevents declaration bundlers from turning references such as
 * TemporalPolyfill.PlainDateTime into a self-reference like
 * Temporal.PlainDateTime while defining Temporal.PlainDateTime.
 */
type PolyfillInstant = TemporalPolyfill.Instant;
type PolyfillPlainDate = TemporalPolyfill.PlainDate;
type PolyfillPlainDateTime = TemporalPolyfill.PlainDateTime;
type PolyfillPlainTime = TemporalPolyfill.PlainTime;

declare global {
  // Prisma 8 RC declarations require the global Temporal namespace.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Temporal {
    type Instant = PolyfillInstant;
    type PlainDate = PolyfillPlainDate;
    type PlainDateTime = PolyfillPlainDateTime;
    type PlainTime = PolyfillPlainTime;
  }
}

export {};
