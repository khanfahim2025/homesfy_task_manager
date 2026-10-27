import { defineConfig } from 'prisma/config';

// D1 migrations are applied with wrangler (see migrations/). The SQLite URL is
// only a scratch target so `prisma migrate diff` can render SQL.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: { url: 'file:./.prisma-scratch.db' },
});
