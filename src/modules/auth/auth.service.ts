import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import {
  generateRefreshToken,
  hashToken,
  parseDurationToMs,
} from '../../common/utils/token.util';
import { UserStatus } from '../users/enums/user.enum';
import { UsersService } from '../users/users.service';
import { SafeUser } from '../users/types/user.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResult, AuthTokens, JwtPayload } from './types/auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(_dto: RegisterDto): Promise<AuthResult> {
    throw new ForbiddenException(
      'Public registration is disabled. Contact your platform administrator for onboarding.',
    );
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.validateCredentials(dto.email, dto.password);
    await this.usersService.updateLastLogin(user.id);
    const tokens = await this.issueTokens(user);
    return { user: this.toAuthUser(user), tokens };
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const tokenHash = hashToken(refreshToken);
    const refreshTokenModel = this.usersService.getRefreshTokenModel();

    const storedToken = await refreshTokenModel.findOne({
      tokenHash,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.usersService.findById(storedToken.userId.toString());
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid or inactive account');
    }

    storedToken.revokedAt = new Date();
    await storedToken.save();

    const tokens = await this.issueTokens(user);
    return { user: this.toAuthUser(user), tokens };
  }

  async logout(refreshToken: string): Promise<{ message: string }> {
    const tokenHash = hashToken(refreshToken);
    const refreshTokenModel = this.usersService.getRefreshTokenModel();

    await refreshTokenModel.updateOne(
      { tokenHash, revokedAt: null },
      { revokedAt: new Date() },
    );

    return { message: 'Logged out successfully' };
  }

  async getProfile(userId: string): Promise<SafeUser> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  private async validateCredentials(
    email: string,
    password: string,
  ): Promise<SafeUser> {
    const user = await this.usersService.findByEmail(email, true);

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.usersService.toSafeUser(user);
  }

  private async issueTokens(user: SafeUser): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      platformRole: user.platformRole,
    };

    const expiresIn = this.configService.get<string>(
      'jwt.accessExpiresIn',
      '15m',
    );

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: expiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });

    const refreshToken = generateRefreshToken();
    const refreshExpiresIn = this.configService.get<string>(
      'jwt.refreshExpiresIn',
      '7d',
    );
    const expiresAt = new Date(
      Date.now() + parseDurationToMs(refreshExpiresIn),
    );

    await this.usersService.getRefreshTokenModel().create({
      userId: new Types.ObjectId(user.id),
      tokenHash: hashToken(refreshToken),
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  private toAuthUser(user: SafeUser) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      platformRole: user.platformRole,
      status: user.status,
    };
  }
}
