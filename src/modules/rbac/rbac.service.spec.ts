import { Test, TestingModule } from '@nestjs/testing';
import { StoreMemberRole } from '../organizations/enums/organization.enum';
import { OrganizationsService } from '../organizations/organizations.service';
import { StoreMembershipsService } from '../stores/store-memberships.service';
import { Permission } from './constants/permissions.constant';
import { RbacService } from './rbac.service';

describe('RbacService', () => {
  let rbacService: RbacService;

  const mockStoreMembershipsService = {
    getMembership: jest.fn(),
  };

  const mockOrganizationsService = {
    isOwner: jest.fn(),
    findForUser: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RbacService,
        {
          provide: StoreMembershipsService,
          useValue: mockStoreMembershipsService,
        },
        {
          provide: OrganizationsService,
          useValue: mockOrganizationsService,
        },
      ],
    }).compile();

    rbacService = module.get<RbacService>(RbacService);
  });

  it('grants cashier order permissions but not invite permissions', () => {
    const permissions = rbacService.getPermissionsForRole(StoreMemberRole.CASHIER);

    expect(permissions).toContain(Permission.ORDERS_CREATE);
    expect(permissions).not.toContain(Permission.INVITES_CREATE);
    expect(permissions).not.toContain(Permission.STORES_UPDATE);
  });

  it('adds stores:create for org owners', async () => {
    mockStoreMembershipsService.getMembership.mockResolvedValue({
      storeId: { toString: () => 'store-1' },
      organizationId: { toString: () => 'org-1' },
      role: StoreMemberRole.OWNER,
    });
    mockOrganizationsService.isOwner.mockResolvedValue(true);

    const context = await rbacService.getStoreContext('user-1', 'store-1');

    expect(context?.permissions).toContain(Permission.STORES_CREATE);
    expect(context?.permissions).toContain(Permission.INVITES_CREATE);
  });

  it('does not add stores:create for managers', async () => {
    mockStoreMembershipsService.getMembership.mockResolvedValue({
      storeId: { toString: () => 'store-1' },
      organizationId: { toString: () => 'org-1' },
      role: StoreMemberRole.MANAGER,
    });
    mockOrganizationsService.isOwner.mockResolvedValue(false);

    const context = await rbacService.getStoreContext('user-1', 'store-1');

    expect(context?.permissions).toContain(Permission.INVITES_CREATE);
    expect(context?.permissions).not.toContain(Permission.STORES_CREATE);
  });
});
