import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Always load server/.env regardless of process cwd (npm workspace, PM2, etc.)
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(serverRoot, '.env') });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT ?? 3001),
  appUrl: required('APP_URL', 'http://localhost:5173'),
  apiUrl: required('API_URL', 'http://localhost:3001'),
  databaseUrl: required('DATABASE_URL'),
  sessionSecret: required('SESSION_SECRET', 'dev-insecure-secret-change-me'),

  allowedEmailDomain: optional('ALLOWED_EMAIL_DOMAIN'),
  allowSignup: (process.env.ALLOW_SIGNUP ?? 'false').toLowerCase() === 'true',

  tokenTtlSetPasswordHours: Number(process.env.TOKEN_TTL_SET_PASSWORD_HOURS ?? 48),
  tokenTtlLoginMinutes: Number(process.env.TOKEN_TTL_LOGIN_MINUTES ?? 15),

  bootstrapAdminEmail: optional('BOOTSTRAP_ADMIN_EMAIL'),
  bootstrapAdminPassword: optional('BOOTSTRAP_ADMIN_PASSWORD'),
  bootstrapMemberPassword: optional('BOOTSTRAP_MEMBER_PASSWORD'),

  smtp: {
    host: optional('SMTP_HOST'),
    port: Number(process.env.SMTP_PORT ?? 587),
    user: optional('SMTP_USER'),
    pass: optional('SMTP_PASS'),
    from: optional('SMTP_FROM') ?? 'noreply@example.com',
  },

  aws: {
    region: optional('AWS_REGION') ?? 'ap-south-1',
    accessKeyId: optional('AWS_ACCESS_KEY_ID'),
    secretAccessKey: optional('AWS_SECRET_ACCESS_KEY'),
    bucket: optional('S3_BUCKET'),
  },

  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 100 * 1024 * 1024),
  uploadDir: process.env.UPLOAD_DIR ?? './uploads',
} as const;

export function s3Enabled(): boolean {
  return Boolean(env.aws.bucket && env.aws.accessKeyId && env.aws.secretAccessKey);
}
