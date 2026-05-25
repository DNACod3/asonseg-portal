import { PrismaClient } from '@prisma/client';

/**
 * Singleton do PrismaClient. Em dev, reaproveita a instância no globalThis para
 * evitar esgotar conexões a cada HMR (CLAUDE.md / project-guideline).
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
