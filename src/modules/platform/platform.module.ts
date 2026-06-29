import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { StoresModule } from '../stores/stores.module';
import { UsersModule } from '../users/users.module';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';

@Module({
  imports: [AuthModule, UsersModule, OrganizationsModule, StoresModule],
  controllers: [PlatformController],
  providers: [PlatformService],
})
export class PlatformModule {}
