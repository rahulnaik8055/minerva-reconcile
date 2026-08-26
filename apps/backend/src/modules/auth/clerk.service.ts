import { Injectable, Logger } from '@nestjs/common';
import { createClerkClient, type ClerkClient } from '@clerk/backend';
import type { User } from '@clerk/backend';

@Injectable()
export class ClerkService {
  private readonly clerk: ClerkClient;
  private readonly logger = new Logger(ClerkService.name);

  constructor() {
    this.clerk = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY!,
    });
  }

  async getUser(clerkId: string): Promise<User | null> {
    try {
      return await this.clerk.users.getUser(clerkId);
    } catch (error) {
      this.logger.warn(`Failed to fetch Clerk user ${clerkId}: ${String(error)}`);
      return null;
    }
  }

  buildFullName(user: { firstName: string | null; lastName: string | null }): string {
    return [user.firstName, user.lastName].filter(Boolean).join(' ') || 'User';
  }

  buildEmail(user: { emailAddresses: { emailAddress: string }[] }): string {
    return user.emailAddresses[0]?.emailAddress ?? '';
  }
}
