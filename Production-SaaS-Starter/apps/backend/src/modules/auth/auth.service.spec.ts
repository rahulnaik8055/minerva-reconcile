import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService, UserRow } from '../users/users.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<
    Pick<UsersService, 'findByEmail' | 'findById' | 'create' | 'toPublicUser'>
  >;

  const mockUser: UserRow = {
    id: 'user-1',
    email: 'jane@company.com',
    fullName: 'Jane Smith',
    passwordHash: 'hashed-password',
    createdAt: new Date('2024-01-15T10:00:00.000Z'),
    updatedAt: new Date('2024-01-15T10:00:00.000Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      toPublicUser: jest.fn((user) => ({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('signed-token') },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'NODE_ENV') return 'development';
              if (key === 'JWT_EXPIRATION') return '7d';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should throw ConflictException when email is already registered', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'jane@company.com',
          fullName: 'Jane Smith',
          password: 'password123',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should create a user, sign a session token, and return the session', async () => {
      usersService.findByEmail.mockResolvedValue(undefined);
      mockedBcrypt.hash.mockResolvedValue('hashed-password' as never);
      usersService.create.mockResolvedValue(mockUser);

      const result = await service.register({
        email: 'jane@company.com',
        fullName: 'Jane Smith',
        password: 'password123',
      });

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(usersService.create).toHaveBeenCalledWith({
        email: 'jane@company.com',
        fullName: 'Jane Smith',
        passwordHash: 'hashed-password',
      });
      expect(result.accessToken).toBe('signed-token');
      expect(result.user).toEqual({
        id: 'user-1',
        email: 'jane@company.com',
        fullName: 'Jane Smith',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      });
      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException for unknown email', async () => {
      usersService.findByEmail.mockResolvedValue(undefined);

      await expect(
        service.login({ email: 'nobody@company.com', password: 'password123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('should throw UnauthorizedException for a wrong password', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(
        service.login({ email: 'jane@company.com', password: 'wrong-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('should return the user and an access token on success', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.login({
        email: 'jane@company.com',
        password: 'password123',
      });

      expect(result.accessToken).toBe('signed-token');
      expect(result.user.email).toBe('jane@company.com');
      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });

  describe('getMe', () => {
    it('should return the user profile for a valid id', async () => {
      usersService.findById.mockResolvedValue(mockUser);

      const result = await service.getMe('user-1');

      expect(result.id).toBe('user-1');
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      usersService.findById.mockResolvedValue(undefined);

      await expect(service.getMe('missing')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
