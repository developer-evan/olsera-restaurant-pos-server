import { SetMetadata } from '@nestjs/common';
import { Permission } from '../constants/permissions.constant';
import {
  PERMISSIONS_KEY,
  PERMISSION_SCOPE_KEY,
  PLATFORM_PERMISSIONS_KEY,
  PermissionScopeOptions,
} from '../types/rbac.types';
import { PlatformPermission } from '../constants/permissions.constant';

export const Permissions = (
  ...permissions: Permission[]
): ReturnType<typeof SetMetadata> => SetMetadata(PERMISSIONS_KEY, permissions);

export const PermissionScope = (
  scope: PermissionScopeOptions,
): ReturnType<typeof SetMetadata> =>
  SetMetadata(PERMISSION_SCOPE_KEY, scope);

export const PlatformPermissions = (
  ...permissions: PlatformPermission[]
): ReturnType<typeof SetMetadata> =>
  SetMetadata(PLATFORM_PERMISSIONS_KEY, permissions);
