import { registerAs } from '@nestjs/config';

export default registerAs('seed', () => ({
  superAdminEmail: process.env.SUPER_ADMIN_EMAIL,
  superAdminPassword: process.env.SUPER_ADMIN_PASSWORD,
  superAdminFirstName: process.env.SUPER_ADMIN_FIRST_NAME ?? 'Super',
  superAdminLastName: process.env.SUPER_ADMIN_LAST_NAME ?? 'Admin',
}));
