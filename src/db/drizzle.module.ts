import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import * as schema from './schema.js';
import 'dotenv/config';

export const DATABASE = Symbol('DATABASE');
const DATABASE_CLIENT = Symbol('DATABASE_CLIENT');
export type Database = PostgresJsDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CLIENT,
      useFactory: (): Sql => {
        const connectionString = process.env.DATABASE_URL;

        if (!connectionString) {
          throw new Error('DATABASE_URL is not configured');
        }

        return postgres(connectionString);
      },
    },
    {
      provide: DATABASE,
      useFactory: (client: Sql): Database => drizzle({ client, schema }),
      inject: [DATABASE_CLIENT],
    },
  ],
  exports: [DATABASE],
})
export class DrizzleModule implements OnApplicationShutdown {
  constructor(@Inject(DATABASE_CLIENT) private readonly client: Sql) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.end();
  }
}
