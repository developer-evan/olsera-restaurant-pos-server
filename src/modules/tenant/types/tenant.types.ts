import { StoreMemberRole } from '../../organizations/enums/organization.enum';

export type UserStoreSummary = {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  currency: string;
  timezone: string;
  status: string;
  role: StoreMemberRole;
  createdAt?: Date;
  updatedAt?: Date;
};

export type StoreContext = {
  storeId: string;
  organizationId: string;
  role: StoreMemberRole;
};
