import { Injectable } from '@nestjs/common';
import { OrganizationsService } from '../organizations/organizations.service';
import { StoreMemberRole } from '../organizations/enums/organization.enum';
import { StoreMembershipsService } from '../stores/store-memberships.service';
import {
  ORG_OWNER_EXTRA_PERMISSIONS,
  STORE_ROLE_PERMISSIONS,
} from './constants/role-permissions.constant';
import {
  ALL_PLATFORM_PERMISSIONS,
  Permission,
  PlatformPermission,
} from './constants/permissions.constant';
import { StoreContextPayload } from './types/rbac.types';

@Injectable()
export class RbacService {
  constructor(
    private readonly storeMembershipsService: StoreMembershipsService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  getPlatformPermissions(): PlatformPermission[] {
    return ALL_PLATFORM_PERMISSIONS;
  }

  getPermissionsForRole(role: StoreMemberRole): Permission[] {
    return STORE_ROLE_PERMISSIONS[role] ?? [];
  }

  async getStoreContext(
    userId: string,
    storeId: string,
  ): Promise<StoreContextPayload | null> {
    const membership = await this.storeMembershipsService.getMembership(
      userId,
      storeId,
    );

    if (!membership) {
      return null;
    }

    const permissions = [...this.getPermissionsForRole(membership.role)];
    const isOrgOwner = await this.organizationsService.isOwner(
      userId,
      membership.organizationId.toString(),
    );

    if (isOrgOwner) {
      for (const permission of ORG_OWNER_EXTRA_PERMISSIONS) {
        if (!permissions.includes(permission)) {
          permissions.push(permission);
        }
      }
    }

    return {
      storeId: membership.storeId.toString(),
      organizationId: membership.organizationId.toString(),
      role: membership.role,
      permissions,
    };
  }

  async hasStorePermission(
    userId: string,
    storeId: string,
    permission: Permission,
  ): Promise<boolean> {
    const context = await this.getStoreContext(userId, storeId);
    return context?.permissions.includes(permission) ?? false;
  }

  async hasOrgPermission(
    userId: string,
    organizationId: string,
    permission: Permission,
  ): Promise<boolean> {
    if (permission === Permission.STORES_CREATE) {
      return this.organizationsService.isOwner(userId, organizationId);
    }

    const organizations = await this.organizationsService.findForUser(userId);
    return organizations.some(
      (organization) => organization._id.toString() === organizationId,
    );
  }

  async hasAnyOrganizationAccess(userId: string): Promise<boolean> {
    const organizations = await this.organizationsService.findForUser(userId);
    return organizations.length > 0;
  }
}
