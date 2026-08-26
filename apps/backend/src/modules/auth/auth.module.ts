import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ClerkAuthGuard } from '../../common/guards/clerk-auth.guard';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { ClerkWebhookController } from './clerk-webhook.controller';
import { ClerkService } from './clerk.service';

@Module({
  imports: [UsersModule],
  controllers: [AuthController, ClerkWebhookController],
  providers: [
    { provide: APP_GUARD, useClass: ClerkAuthGuard },
    ClerkService,
  ],
  exports: [ClerkService],
})
export class AuthModule {}
