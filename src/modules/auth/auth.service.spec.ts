import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { UserStatus } from '../users/enums/user.enum';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let authService: AuthService;

  const mockRefreshTokenModel = {
    create: jest.fn().mockResolvedValue({}),
    findOne: jest.fn(),
    updateOne: jest.fn().mockResolvedValue({}),
  };

  const mockUsersService = {
    create: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
    updateLastLogin: jest.fn(),
    toSafeUser: jest.fn(),
    getRefreshTokenModel: jest.fn(() => mockRefreshTokenModel),
  };

  const mockJwtService = {
    signAsync: jest.fn().mockResolvedValue('access-token'),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const values: Record<string, string> = {
        'jwt.accessExpiresIn': '15m',
        'jwt.refreshExpiresIn': '7d',
      };
      return values[key] ?? defaultValue;
    }),
  };

  const safeUser = {
    id: '507f1f77bcf86cd799439011',
    email: 'owner@coffee.com',
    firstName: 'Ali',
    lastName: 'Hassan',
    platformRole: null,
    status: UserStatus.ACTIVE,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  it('blocks public registration', async () => {
    await expect(
      authService.register({
        email: 'owner@coffee.com',
        password: 'SecurePass123',
        firstName: 'Ali',
        lastName: 'Hassan',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('logs in with valid credentials', async () => {
    const passwordHash = await bcrypt.hash('SecurePass123', 10);
    mockUsersService.findByEmail.mockResolvedValue({
      ...safeUser,
      passwordHash,
    });
    mockUsersService.toSafeUser.mockReturnValue(safeUser);

    const result = await authService.login({
      email: 'owner@coffee.com',
      password: 'SecurePass123',
    });

    expect(result.user.email).toBe('owner@coffee.com');
    expect(mockUsersService.updateLastLogin).toHaveBeenCalledWith(safeUser.id);
  });

  it('rejects invalid login credentials', async () => {
    mockUsersService.findByEmail.mockResolvedValue(null);

    await expect(
      authService.login({
        email: 'wrong@coffee.com',
        password: 'SecurePass123',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
