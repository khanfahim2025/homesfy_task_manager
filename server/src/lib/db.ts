import { PrismaD1 } from '@prisma/adapter-d1';
import { PrismaClient } from '../generated/prisma/client';

let client: PrismaClient | undefined;
let boundTo: D1Database | undefined;

/** One Prisma client per isolate, rebuilt only if the D1 binding changes. */
export function getDb(d1: D1Database): PrismaClient {
  if (!client || boundTo !== d1) {
    client = new PrismaClient({ adapter: new PrismaD1(d1) });
    boundTo = d1;
  }
  return client;
}
