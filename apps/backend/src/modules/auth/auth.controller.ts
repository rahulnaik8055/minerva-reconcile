import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser, Public } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/pipes';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { loginSchema, LoginDto } from './dto/login.dto';
import { LogoutResponseDto } from './dto/logout-response.dto';
import { RegisterDto, registerSchema } from './dto/register.dto';
import { COOKIE_NAME } from './auth.constants';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user account and start a session' })
  @ApiCreatedResponse({
    description: 'Account created successfully. Sets the session cookie.',
    type: AuthResponseDto,
  })
  @ApiConflictResponse({ description: 'Email is already registered' })
  async register(
    @Body(new ZodValidationPipe(registerSchema)) dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.register(dto);

    res.cookie(COOKIE_NAME, result.accessToken, this.authService.getCookieOptions());

    return result;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in and receive a JWT access token' })
  @ApiOkResponse({
    description: 'Authenticated successfully',
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.login(dto);

    res.cookie(COOKIE_NAME, result.accessToken, this.authService.getCookieOptions());

    return result;
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the currently authenticated user' })
  @ApiOkResponse({
    description: 'Current user profile',
    type: UserResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  me(@CurrentUser('sub') userId: string): Promise<UserResponseDto> {
    return this.authService.getMe(userId);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out (stateless, clears session cookie)' })
  @ApiOkResponse({
    description: 'Logged out successfully',
    type: LogoutResponseDto,
  })
  logout(@Res({ passthrough: true }) res: Response): LogoutResponseDto {
    res.clearCookie(COOKIE_NAME, { path: '/' });

    return { message: 'Logged out successfully' };
  }
}
