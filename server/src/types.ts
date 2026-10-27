import type { PrismaClient, User } from './generated/prisma/client';

export interface Bindings {
  DB: D1Database;
  ASSETS: Fetcher;

  APP_URL: string;
  ALLOWED_EMAIL_DOMAIN?: string;
  SESSION_SECRET: string;

  AWS_REGION: string;
  S3_BUCKET: string;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  MAX_UPLOAD_MB?: string;

  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
}

export interface Variables {
  db: PrismaClient;
  user?: User;
}

export type AppEnv = { Bindings: Bindings; Variables: Variables };

/** Env for routers mounted behind requireAuth, where `user` is always set. */
export type AuthedEnv = { Bindings: Bindings; Variables: Variables & { user: User } };
