import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env, s3Enabled } from './lib/env.js';
import { prisma } from './lib/prisma.js';
import { loadUser } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/error.js';
import { bootstrapAdmin } from './bootstrap.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { projectsRouter } from './routes/projects.js';
import { tasksRouter } from './routes/tasks.js';
import { attachmentFilesRouter } from './routes/attachments.js';

const PgSession = connectPgSimple(session);
const app = express();

app.set('trust proxy', 1);
app.use(
  cors({
    origin: env.appUrl,
    credentials: true,
  })
);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  session({
    name: 'sid',
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: new PgSession({
      conString: env.databaseUrl,
      tableName: 'session',
      createTableIfMissing: true,
    }),
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.isProd,
      maxAge: 1000 * 60 * 60 * 24 * 30,
    },
  })
);
app.use(loadUser);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, env: env.nodeEnv, time: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/attachments', attachmentFilesRouter);

if (env.isProd) {
  const serverDir = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.resolve(serverDir, '../../client/dist');
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (_req, res, next) => {
    res.sendFile(path.join(clientDist, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
}

app.use(notFound);
app.use(errorHandler);

async function main(): Promise<void> {
  await prisma.$connect();
  await bootstrapAdmin();
  app.listen(env.port, () => {
    const storage = s3Enabled()
      ? `S3 (${env.aws.region}/${env.aws.bucket})`
      : `local (${env.uploadDir})`;
    console.log(`API listening on http://localhost:${env.port} (${env.nodeEnv})`);
    console.log(`Attachment storage: ${storage}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
