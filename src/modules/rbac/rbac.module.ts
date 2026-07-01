import { Global, Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { StoresModule } from '../stores/stores.module';
import { TenantGuard } from '../tenant/guards/tenant.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RbacController } from './rbac.controller';
import { RbacService } from './rbac.service';

@Global()
@Module({
  imports: [StoresModule, OrganizationsModule],
  controllers: [RbacController],
  providers: [RbacService, PermissionsGuard, TenantGuard],
  exports: [RbacService, PermissionsGuard],
})
export class RbacModule {}
