import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PlatformRole, UserStatus } from '../src/modules/users/enums/user.enum';
import { UsersService } from '../src/modules/users/users.service';

type SuperAdminCredentials = {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
};

export async function seedTestSuperAdmin(
  app: INestApplication,
  credentials: SuperAdminCredentials,
): Promise<void> {
  const usersService = app.get(UsersService);
  const existing = await usersService.findByEmail(credentials.email, true);

  if (existing?.platformRole === PlatformRole.SUPER_ADMIN) {
    existing.passwordHash = await bcrypt.hash(credentials.password, 10);
    existing.status = UserStatus.ACTIVE;
    await existing.save();
    return;
  }

  if (existing) {
    existing.platformRole = PlatformRole.SUPER_ADMIN;
    existing.passwordHash = await bcrypt.hash(credentials.password, 10);
    existing.status = UserStatus.ACTIVE;
    await existing.save();
    return;
  }

  const passwordHash = await bcrypt.hash(credentials.password, 10);
  await usersService.create({
    email: credentials.email,
    passwordHash,
    firstName: credentials.firstName ?? 'Super',
    lastName: credentials.lastName ?? 'Admin',
    platformRole: PlatformRole.SUPER_ADMIN,
    status: UserStatus.ACTIVE,
  });
}
