export enum Permission {
  ORGANIZATIONS_READ = 'organizations:read',
  STORES_READ = 'stores:read',
  STORES_CREATE = 'stores:create',
  STORES_UPDATE = 'stores:update',
  INVITES_CREATE = 'invites:create',
  INVITES_READ = 'invites:read',
  CATEGORIES_READ = 'categories:read',
  CATEGORIES_CREATE = 'categories:create',
  CATEGORIES_UPDATE = 'categories:update',
  CATEGORIES_DELETE = 'categories:delete',
  PRODUCTS_READ = 'products:read',
  PRODUCTS_CREATE = 'products:create',
  PRODUCTS_UPDATE = 'products:update',
  PRODUCTS_DELETE = 'products:delete',
  PROMOS_READ = 'promos:read',
  PROMOS_CREATE = 'promos:create',
  PROMOS_UPDATE = 'promos:update',
  PROMOS_DELETE = 'promos:delete',
  ORDERS_CREATE = 'orders:create',
  ORDERS_READ = 'orders:read',
  ORDERS_UPDATE = 'orders:update',
  TRANSACTIONS_READ = 'transactions:read',
  TRANSACTIONS_CREATE = 'transactions:create',
  TRANSACTIONS_REFUND = 'transactions:refund',
  ANALYTICS_READ = 'analytics:read',
}

export enum PlatformPermission {
  ORGANIZATIONS_CREATE = 'platform:organizations:create',
  ORGANIZATIONS_READ = 'platform:organizations:read',
  ONBOARDING_CREATE = 'platform:onboarding:create',
}

export const ALL_PLATFORM_PERMISSIONS = Object.values(PlatformPermission);
