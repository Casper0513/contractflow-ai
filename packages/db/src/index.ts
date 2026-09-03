import { Prisma } from "./generated/prisma/client";

export { prisma } from "./client";
export * from "./generated/prisma/client";

export const Decimal = Prisma.Decimal;
export type Decimal = Prisma.Decimal;
export const PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError;
export type PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError;
export const TransactionIsolationLevel = Prisma.TransactionIsolationLevel;
export type TransactionIsolationLevel = Prisma.TransactionIsolationLevel;
