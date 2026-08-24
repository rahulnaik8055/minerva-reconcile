import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { DatabaseConnection } from '../interfaces/database.interface';

export const DATABASE_CONNECTION = 'DATABASE_CONNECTION';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CONNECTION,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService): Promise<DatabaseConnection> => {
        const logger = new Logger('DatabaseModule');

        const connectionString = configService.get<string>('DATABASE_URL');

        if (!connectionString) {
          throw new Error('DATABASE_URL is not defined');
        }

        const pool = new Pool({
          connectionString,
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        });

        pool.on('error', (err: Error) => {
          logger.error('Unexpected error on idle client', err);
        });

        try {
          await pool.query('SELECT 1');
          logger.log('Database connection established successfully');
        } catch (error) {
          logger.error('Failed to connect to database', error);
          throw error;
        }

        const db = drizzle(pool, { schema });

        return { pool, db };
      },
    },
  ],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}
