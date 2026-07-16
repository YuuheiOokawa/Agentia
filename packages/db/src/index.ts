import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";

/** Single shared Prisma client for the whole server process (docs/11_DATABASE_DESIGN.md #7). */
export const prisma = new PrismaClient();
