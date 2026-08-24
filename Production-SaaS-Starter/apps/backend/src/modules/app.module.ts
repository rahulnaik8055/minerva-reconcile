import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DatabaseModule } from '../database/database.module';
import { validationSchema } from '../config/env.validation';
import { createLoggerConfig } from '../common/logging/logger.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema,
      envFilePath: '.env',
    }),
    WinstonModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => createLoggerConfig(configService),
    }),
    DatabaseModule,
    HealthModule,
    UsersModule,
    AuthModule,
  ],
})
export class AppModule {}
