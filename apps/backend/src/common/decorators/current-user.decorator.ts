import { createParamDecorator, ExecutionContext } from '@nestjs/common';

interface ClerkUser {
  sub: string;
  email: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof ClerkUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as ClerkUser;

    return data ? user?.[data] : user;
  },
);
