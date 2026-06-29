import { PlatformRole, UserStatus } from '../enums/user.enum';

export type SafeUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  platformRole: PlatformRole | null;
  status: UserStatus;
  lastLoginAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type CreateUserInput = {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  platformRole?: PlatformRole | null;
  status?: UserStatus;
};
