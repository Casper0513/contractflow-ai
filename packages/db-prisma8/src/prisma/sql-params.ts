import { Temporal } from "@js-temporal/polyfill";
import { param } from "@prisma/orm-postgres/relational-core/expression";

type Prisma8ParamRef = ReturnType<typeof param>;

/**
 * Parameterized PostgreSQL text value for Prisma 8 SQL-builder queries.
 */
export function prisma8TextParam(value: string): Prisma8ParamRef {
  return param(value, {
    codecId: "pg/text@1",
  });
}

/**
 * Parameterized JSON value intended for an explicit ::jsonb cast
 * in Prisma 8 PostgreSQL SQL-builder expressions.
 */
export function prisma8JsonbParam(value: unknown): Prisma8ParamRef {
  return param(JSON.stringify(value), {
    codecId: "pg/text@1",
  });
}

export function prisma8TimestampParam(value: Temporal.PlainDateTime): Prisma8ParamRef {
  return param(value, {
    codecId: "pg/timestamp-temporal@1",
  });
}
