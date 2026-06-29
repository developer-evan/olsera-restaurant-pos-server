import {
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { ClientSession, Model } from 'mongoose';
import { PlatformRole, UserStatus } from './enums/user.enum';
import { RefreshToken } from './schemas/refresh-token.schema';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserInput, SafeUser } from './types/user.types';

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(RefreshToken.name)
    private readonly refreshTokenModel: Model<RefreshToken>,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedSuperAdminIfNeeded();
  }

  async create(
    input: CreateUserInput,
    session?: ClientSession,
  ): Promise<SafeUser> {
    try {
      const [user] = await this.userModel.create(
        [
          {
            email: input.email.toLowerCase(),
            passwordHash: input.passwordHash,
            firstName: input.firstName,
            lastName: input.lastName,
            platformRole: input.platformRole ?? null,
            status: input.status ?? UserStatus.ACTIVE,
          },
        ],
        { session },
      );

      return this.toSafeUser(user);
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  async findByEmail(
    email: string,
    includePassword = false,
  ): Promise<UserDocument | null> {
    let query = this.userModel.findOne({ email: email.toLowerCase() });

    if (includePassword) {
      query = query.select('+passwordHash');
    }

    return query.exec();
  }

  async findById(id: string): Promise<SafeUser | null> {
    const user = await this.userModel.findById(id).exec();
    return user ? this.toSafeUser(user) : null;
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.userModel
      .updateOne({ _id: userId }, { lastLoginAt: new Date() })
      .exec();
  }

  async hasSuperAdmin(): Promise<boolean> {
    const count = await this.userModel
      .countDocuments({ platformRole: PlatformRole.SUPER_ADMIN })
      .exec();
    return count > 0;
  }

  toSafeUser(user: UserDocument): SafeUser {
    return {
      id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      platformRole: user.platformRole ?? null,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  getRefreshTokenModel(): Model<RefreshToken> {
    return this.refreshTokenModel;
  }

  private async seedSuperAdminIfNeeded(): Promise<void> {
    const email = this.configService.get<string>('seed.superAdminEmail');
    const password = this.configService.get<string>('seed.superAdminPassword');
    const firstName =
      this.configService.get<string>('seed.superAdminFirstName') ?? 'Super';
    const lastName =
      this.configService.get<string>('seed.superAdminLastName') ?? 'Admin';

    if (!email || !password) {
      return;
    }

    if (await this.hasSuperAdmin()) {
      this.logger.log('Super admin already exists — skipping seed');
      return;
    }

    const existingUser = await this.findByEmail(email, true);
    if (existingUser) {
      existingUser.platformRole = PlatformRole.SUPER_ADMIN;
      existingUser.passwordHash = await bcrypt.hash(password, 10);
      existingUser.status = UserStatus.ACTIVE;
      await existingUser.save();
      this.logger.log(`Promoted existing user to super admin: ${email}`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    try {
      await this.create({
        email,
        passwordHash,
        firstName,
        lastName,
        platformRole: PlatformRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
      });
      this.logger.log(`Super admin seeded for ${email}`);
    } catch (error) {
      if (
        error instanceof ConflictException ||
        this.isDuplicateKeyError(error)
      ) {
        const user = await this.findByEmail(email, true);
        if (user) {
          user.platformRole = PlatformRole.SUPER_ADMIN;
          user.passwordHash = passwordHash;
          user.status = UserStatus.ACTIVE;
          await user.save();
          this.logger.log(`Promoted existing user to super admin: ${email}`);
        }
        return;
      }
      throw error;
    }
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: number }).code === 11000
    );
  }
}
