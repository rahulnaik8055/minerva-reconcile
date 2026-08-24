import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { CookieOptions } from 'express';
import { JwtTokenPayload } from '../../interfaces';
import { UsersService, UserRow } from '../users/users.service';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { BCRYPT_ROUNDS, DEFAULT_JWT_EXPIRATION } from './auth.constants';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existing = await this.usersService.findByEmail(dto.email);

    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.usersService.create({
      email: dto.email,
      fullName: dto.fullName,
      passwordHash,
    });

    return this.createSession(user);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.createSession(user);
  }

  private async createSession(user: UserRow): Promise<AuthResponseDto> {
    const payload: JwtTokenPayload = {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      user: this.usersService.toPublicUser(user),
      accessToken,
    };
  }

  async getMe(userId: string): Promise<UserResponseDto> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.usersService.toPublicUser(user);
  }

  getCookieOptions(): CookieOptions {
    const expiration = this.configService.get<string>('JWT_EXPIRATION') ?? DEFAULT_JWT_EXPIRATION;
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: this.parseDurationToMs(expiration),
    };
  }

  private parseDurationToMs(duration: string): number {
    const match = /^(\d+)([smhd])$/.exec(duration);

    if (!match) {
      return this.parseDurationToMs(DEFAULT_JWT_EXPIRATION);
    }

    const value = Number.parseInt(match[1] ?? '7', 10);
    const unit = match[2];

    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return value * (multipliers[unit] ?? this.parseDurationToMs(DEFAULT_JWT_EXPIRATION));
  }
}
