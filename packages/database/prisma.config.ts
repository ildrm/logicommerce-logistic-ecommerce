import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

dotenv.config({ path: '../../.env' });
dotenv.config();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: {
    url:
      process.env.DATABASE_URL ??
      'mysql://logicommerce:logicommerce_local@localhost:3306/logicommerce',
  },
});
