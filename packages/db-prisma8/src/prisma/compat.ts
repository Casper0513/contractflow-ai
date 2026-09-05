import { Temporal } from "@js-temporal/polyfill";

import type { Numeric } from "@prisma/orm-postgres/target/codec-types";

import { db } from "./db.js";

/**
 * Prisma 8 PostgreSQL Timestamp fields use Temporal.PlainDateTime.
 *
 * ContractFlow currently treats persisted timestamp-without-time-zone
 * values as UTC wall-clock timestamps. Keep that conversion here rather
 * than leaking Temporal throughout the API.
 */
/**
 * Converts Prisma 8 PostgreSQL Timestamp values back to JavaScript Date.
 *
 * ContractFlow historically treats timestamp-without-time-zone values as
 * UTC wall-clock timestamps. Keep that behavior stable at the DB boundary.
 */
export function fromPrisma8Timestamp(value: Temporal.PlainDateTime): Date {
  return new Date(value.toZonedDateTime("UTC").toInstant().epochMilliseconds);
}

export function toPrisma8Timestamp(value: Date = new Date()): Temporal.PlainDateTime {
  if (Number.isNaN(value.getTime())) {
    throw new Error("Cannot convert invalid Date to Prisma 8 timestamp");
  }

  return Temporal.Instant.from(value.toISOString())
    .toZonedDateTimeISO("UTC")
    .toPlainDateTime()
    .round({
      smallestUnit: "millisecond",
    });
}

/**
 * Creates a Prisma 8 PostgreSQL Numeric<P,S> value.
 *
 * Prisma 8 RC represents Numeric as a branded string and its PostgreSQL
 * codec expects canonical decimal text. This adapter validates precision
 * and scale before applying that brand.
 *
 * This intentionally rejects NaN and Infinity because ContractFlow's
 * persisted financial/quantity values must be finite.
 */
export function toPrisma8Numeric<P extends number, S extends number>(
  value: string,
  precision: P,
  scale: S,
): Numeric<P, S> {
  if (!Number.isInteger(precision) || precision <= 0) {
    throw new Error(`Numeric precision must be a positive integer: ${precision}`);
  }

  if (!Number.isInteger(scale) || scale < 0 || scale > precision) {
    throw new Error(`Numeric scale must be between 0 and precision: ${scale}`);
  }

  if (!/^-?\d+(?:\.\d+)?$/.test(value)) {
    throw new Error(`Invalid canonical numeric text: ${value}`);
  }

  const unsigned = value.startsWith("-") ? value.slice(1) : value;

  const [rawIntegerPart, fractionalPart = ""] = unsigned.split(".");

  if (fractionalPart.length > scale) {
    throw new Error(`Numeric(${precision},${scale}) scale exceeded: ${value}`);
  }

  const integerPart = rawIntegerPart.replace(/^0+(?=\d)/, "");

  const maximumIntegerDigits = precision - scale;

  /*
   * PostgreSQL numeric precision concerns significant decimal
   * positions. Leading zeroes do not consume integer precision.
   */
  const significantIntegerDigits = /^0+$/.test(integerPart) ? 0 : integerPart.length;

  if (significantIntegerDigits > maximumIntegerDigits) {
    throw new Error(
      `Numeric(${precision},${scale}) integer precision exceeded: ${value}`,
    );
  }

  return value as Numeric<P, S>;
}

export type Prisma8Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Prisma 8 RC does not currently expose an isolation-level option on
 * db.transaction(). PostgreSQL allows the active transaction level to
 * be changed before application queries execute.
 *
 * This statement executes through the exact transaction context used
 * by tx.orm.
 */
export async function setPrisma8Serializable(tx: Prisma8Transaction): Promise<void> {
  const plan = db.raw.sql`
      SET TRANSACTION ISOLATION LEVEL SERIALIZABLE
    `
    .affectedCount()
    .build();

  await tx.execute(plan);
}

export type Prisma8DatabaseErrorKind =
  "unique-violation" | "foreign-key-violation" | "unknown";

export interface Prisma8DatabaseErrorInfo {
  kind: Prisma8DatabaseErrorKind;
  sqlState: string | null;
  constraint: string | null;
  table: string | null;
  detail: string | null;
}

/**
 * Extracts stable PostgreSQL database-error semantics from Prisma 8 RC.
 *
 * Do not make application code depend directly on SqlQueryError,
 * DatabaseError, or RC-specific constructor names. SQLSTATE is the
 * compatibility boundary.
 */
export function getPrisma8DatabaseErrorInfo(error: unknown): Prisma8DatabaseErrorInfo {
  if (typeof error !== "object" || error === null) {
    return {
      kind: "unknown",
      sqlState: null,
      constraint: null,
      table: null,
      detail: null,
    };
  }

  const candidate = error as Record<string, unknown>;

  const cause =
    typeof candidate.cause === "object" && candidate.cause !== null
      ? (candidate.cause as Record<string, unknown>)
      : null;

  const readString = (key: string): string | null => {
    const direct = candidate[key];

    if (typeof direct === "string") {
      return direct;
    }

    const nested = cause?.[key];

    if (typeof nested === "string") {
      return nested;
    }

    return null;
  };

  /*
   * Prisma 8 SqlQueryError exposes sqlState directly.
   * The underlying pg DatabaseError exposes the same
   * value as code.
   */
  const sqlState = readString("sqlState") ?? readString("code");

  let kind: Prisma8DatabaseErrorKind = "unknown";

  switch (sqlState) {
    case "23505":
      kind = "unique-violation";
      break;

    case "23503":
      kind = "foreign-key-violation";
      break;
  }

  return {
    kind,
    sqlState,
    constraint: readString("constraint"),
    table: readString("table"),
    detail: readString("detail"),
  };
}

export function isPrisma8UniqueViolation(error: unknown): boolean {
  return getPrisma8DatabaseErrorInfo(error).kind === "unique-violation";
}

export function isPrisma8ForeignKeyViolation(error: unknown): boolean {
  return getPrisma8DatabaseErrorInfo(error).kind === "foreign-key-violation";
}
