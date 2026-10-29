import { PrismaClient } from "@prisma/client";

// One PrismaClient per process. Next.js bundles route handlers, server components and instrumentation
// separately, so a module-level client would be instantiated once per bundle (each with its own pool) —
// cache it on globalThis in EVERY environment, production included.
//
// Pool sizing: set `connection_limit` and `pool_timeout` in DATABASE_URL, e.g.
//   postgresql://…/db?sslmode=require&pgbouncer=true&connection_limit=10&pool_timeout=20
// Keep connection_limit × instances below the Neon pooler / Postgres max_connections, and pool_timeout
// short enough that a starved request fails fast instead of hanging the worker.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = (globalForPrisma.prisma ??= new PrismaClient());
