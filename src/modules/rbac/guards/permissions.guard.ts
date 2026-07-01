import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { STORE_ID_HEADER } from '../../../common/constants/headers.constants';
import { PlatformRole } from '../../users/enums/user.enum';
import { SafeUser } from '../../users/types/user.types';
import { Permission, PlatformPermission } from '../constants/permissions.constant';
import { RbacService } from '../rbac.service';
import {
  PERMISSIONS_KEY,
  PERMISSION_SCOPE_KEY,
  PLATFORM_PERMISSIONS_KEY,
  PermissionScopeOptions,
  StoreContextPayload,
} from '../types/rbac.types';

type AuthenticatedRequest = Request & {
  user?: SafeUser;
  storeContext?: StoreContextPayload;
  body: Record<string, string>;
  params: Record<string, string>;
  headers: Record<string, string | string[] | undefined>;
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const platformPermissions = this.reflector.getAllAndOverride<
      PlatformPermission[]
    >(PLATFORM_PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    if (platformPermissions?.length) {
      return this.canActivatePlatform(context, platformPermissions);
    }

    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      return false;
    }

    const scope =
      this.reflector.getAllAndOverride<PermissionScopeOptions>(
        PERMISSION_SCOPE_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? {};

    const orgScopedPermissions = requiredPermissions.filter(
      (permission) => permission === Permission.STORES_CREATE,
    );
    const storeScopedPermissions = requiredPermissions.filter(
      (permission) =>
        permission !== Permission.STORES_CREATE &&
        permission !== Permission.ORGANIZATIONS_READ,
    );
    const orgReadRequired = requiredPermissions.includes(
      Permission.ORGANIZATIONS_READ,
    );

    if (orgScopedPermissions.length > 0) {
      const organizationId = this.resolveOrganizationId(request, scope);
      if (!organizationId) {
        throw new ForbiddenException('Organization context is required');
      }

      for (const permission of orgScopedPermissions) {
        const allowed = await this.rbacService.hasOrgPermission(
          user.id,
          organizationId,
          permission,
        );
        if (!allowed) {
          throw new ForbiddenException(
            `Missing required permission: ${permission}`,
          );
        }
      }
    }

    if (orgReadRequired) {
      const hasOrganizationAccess =
        await this.rbacService.hasAnyOrganizationAccess(user.id);
      if (!hasOrganizationAccess) {
        throw new ForbiddenException(
          'Missing required permission: organizations:read',
        );
      }
    }

    if (storeScopedPermissions.length > 0) {
      const storeId = this.resolveStoreId(request, scope);
      if (!storeId) {
        throw new ForbiddenException(
          'Store context is required. Pass storeId in the route or X-Store-Id header.',
        );
      }

      const storeContext = await this.rbacService.getStoreContext(
        user.id,
        storeId,
      );

      if (!storeContext) {
        throw new ForbiddenException('You are not a member of this store');
      }

      request.storeContext = storeContext;

      for (const permission of storeScopedPermissions) {
        if (!storeContext.permissions.includes(permission)) {
          throw new ForbiddenException(
            `Missing required permission: ${permission}`,
          );
        }
      }
    }

    return true;
  }

  private canActivatePlatform(
    context: ExecutionContext,
    requiredPermissions: PlatformPermission[],
  ): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (user?.platformRole !== PlatformRole.SUPER_ADMIN) {
      throw new ForbiddenException('Super admin access required');
    }

    const granted = this.rbacService.getPlatformPermissions();
    const missing = requiredPermissions.filter(
      (permission) => !granted.includes(permission),
    );

    if (missing.length > 0) {
      throw new ForbiddenException(
        `Missing platform permission: ${missing.join(', ')}`,
      );
    }

    return true;
  }

  private resolveStoreId(
    request: AuthenticatedRequest,
    scope: PermissionScopeOptions,
  ): string | undefined {
    if (scope.storeIdParam && request.params[scope.storeIdParam]) {
      return request.params[scope.storeIdParam];
    }

    const headerValue = request.headers[STORE_ID_HEADER];
    if (typeof headerValue === 'string' && headerValue.length > 0) {
      return headerValue;
    }

    return request.params.storeId;
  }

  private resolveOrganizationId(
    request: AuthenticatedRequest,
    scope: PermissionScopeOptions,
  ): string | undefined {
    if (scope.orgIdParam && request.params[scope.orgIdParam]) {
      return request.params[scope.orgIdParam];
    }

    if (scope.orgIdBody && request.body[scope.orgIdBody]) {
      return request.body[scope.orgIdBody];
    }

    return request.body.organizationId;
  }
}
