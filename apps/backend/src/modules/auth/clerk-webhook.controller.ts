import { Controller, Post, Req, Res, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { verifyWebhook } from '@clerk/backend/webhooks';
import { Public } from '../../common/decorators';
import { UsersService } from '../users/users.service';

@Controller('webhooks')
export class ClerkWebhookController {
  private readonly logger = new Logger(ClerkWebhookController.name);

  constructor(private readonly usersService: UsersService) {}

  @Post('clerk')
  @Public()
  async handleClerkWebhook(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const evt = await verifyWebhook(req as unknown as globalThis.Request, {
        signingSecret: process.env.CLERK_WEBHOOK_SIGNING_SECRET || process.env.CLERK_SECRET_KEY,
      });

      switch (evt.type) {
        case 'user.created':
        case 'user.updated': {
          const data = evt.data;
          await this.usersService.upsertFromClerk({
            clerkId: data.id,
            email:
              data.email_addresses[0]?.email_address ?? '',
            fullName: [data.first_name, data.last_name].filter(Boolean).join(' ') || 'User',
          });
          this.logger.log(`Clerk ${evt.type}: ${data.id}`);
          break;
        }
        case 'user.deleted': {
          const data = evt.data;
          if (data.id) {
            await this.usersService.deleteByClerkId(data.id);
            this.logger.log(`Clerk user.deleted: ${data.id}`);
          }
          break;
        }
      }

      res.json({ received: true });
    } catch (err) {
      this.logger.error(`Webhook error: ${err}`);
      res.status(400).json({ error: 'Webhook verification failed' });
    }
  }
}
