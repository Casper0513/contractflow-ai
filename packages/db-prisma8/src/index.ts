import "./prisma/temporal-global.js";

export { db } from "./prisma/db.js";

export {
  fromPrisma8Timestamp,
  getPrisma8DatabaseErrorInfo,
  isPrisma8ForeignKeyViolation,
  isPrisma8UniqueViolation,
  setPrisma8Serializable,
  toPrisma8Numeric,
  toPrisma8Timestamp,
} from "./prisma/compat.js";

export type {
  Prisma8DatabaseErrorInfo,
  Prisma8DatabaseErrorKind,
  Prisma8Transaction,
} from "./prisma/compat.js";

/**
 * Application-owned transaction name.
 *
 * ContractFlow services should depend on this type instead of
 * Prisma.TransactionClient so the application is not coupled to a
 * particular Prisma runtime implementation.
 */
export type { Prisma8Transaction as DatabaseTransaction } from "./prisma/compat.js";

export {
  prisma8JsonbParam,
  prisma8TextParam,
  prisma8TimestampParam,
} from "./prisma/sql-params.js";
