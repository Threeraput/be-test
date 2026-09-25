import { Global, Module } from '@nestjs/common';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import 'dotenv/config';

export const DATABASE = Symbol('DATABASE');
export type Database = PostgresJsDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      useFactory: (): Database => {
        const connectionString = process.env.DATABASE_URL;

        if (!connectionString) {
          throw new Error('DATABASE_URL is not configured');
        }

        return drizzle({
          client: postgres(connectionString),
          schema,
        });
      },
    },
  ],
  exports: [DATABASE],
})
export class DrizzleModule {}