import { StoreMemberRole } from '../../organizations/enums/organization.enum';
import { Permission } from '../constants/permissions.constant';

export type StoreContextPayload = {
  storeId: string;
  organizationId: string;
  role: StoreMemberRole;
  permissions: Permission[];
};

export type PermissionScopeOptions = {
  storeIdParam?: string;
  orgIdBody?: string;
  orgIdParam?: string;
};

export const PERMISSIONS_KEY = 'permissions';
export const PERMISSION_SCOPE_KEY = 'permission_scope';
export const PLATFORM_PERMISSIONS_KEY = 'platform_permissions';
