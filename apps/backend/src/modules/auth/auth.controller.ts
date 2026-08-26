import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators';
import { UsersService } from '../users/users.service';
import { ClerkService } from './clerk.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly usersService: UsersService,
    private readonly clerkService: ClerkService,
  ) {}

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the currently authenticated user, synced from Clerk' })
  @ApiOkResponse({ description: 'Current user profile' })
  async me(
    @CurrentUser() user: { sub: string; email: string },
  ): Promise<ReturnType<UsersService['toPublicUser']>> {
    const clerkUser = await this.clerkService.getUser(user.sub);

    const localUser = await this.usersService.upsertFromClerk({
      clerkId: user.sub,
      email: clerkUser ? this.clerkService.buildEmail(clerkUser) : user.email,
      fullName: clerkUser
        ? this.clerkService.buildFullName(clerkUser)
        : user.email,
    });

    return this.usersService.toPublicUser(localUser);
  }
}
