import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InvitesModule } from '../invites/invites.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { StoresModule } from '../stores/stores.module';
import { UsersModule } from '../users/users.module';
import { OrganizationsController } from './organizations.controller';
import { StoresController } from './stores.controller';
import { TenantService } from './tenant.service';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    OrganizationsModule,
    StoresModule,
    InvitesModule,
  ],
  controllers: [OrganizationsController, StoresController],
  providers: [TenantService],
})
export class TenantModule {}
