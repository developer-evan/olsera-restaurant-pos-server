import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { StoreMemberRole } from '../organizations/enums/organization.enum';
import { OrganizationsService } from '../organizations/organizations.service';
import { UsersService } from '../users/users.service';
import { CreateStoreInviteDto } from '../invites/dto/create-store-invite.dto';
import { InvitesService } from '../invites/invites.service';
import { CreateStoreDto, UpdateStoreDto } from '../stores/dto/store.dto';
import { StoreMembershipsService } from '../stores/store-memberships.service';
import { StoresService } from '../stores/stores.service';

@Injectable()
export class TenantService {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly storeMembershipsService: StoreMembershipsService,
    private readonly storesService: StoresService,
    private readonly invitesService: InvitesService,
    private readonly usersService: UsersService,
  ) {}

  async getMyOrganizations(userId: string) {
    const organizations =
      await this.organizationsService.findForUser(userId);
    return organizations.map((organization) =>
      this.organizationsService.toResponse(organization),
    );
  }

  async listMyStores(userId: string) {
    return this.storeMembershipsService.findStoresForUser(userId);
  }

  async getStore(userId: string, storeId: string) {
    return this.storeMembershipsService.findStoreForUser(userId, storeId);
  }

  async createStore(userId: string, dto: CreateStoreDto) {
    const store = await this.storeMembershipsService.createStore({
      organizationId: dto.organizationId,
      name: dto.name,
      ownerId: userId,
      currency: dto.currency,
      timezone: dto.timezone,
    });

    return {
      ...this.storesService.toResponse(store),
      role: StoreMemberRole.OWNER,
    };
  }

  async updateStore(
    userId: string,
    storeId: string,
    dto: UpdateStoreDto,
    role: StoreMemberRole,
  ) {
    const store = await this.storeMembershipsService.updateStore(storeId, dto);
    return {
      ...this.storesService.toResponse(store),
      role,
    };
  }

  async createStoreInvite(
    userId: string,
    storeId: string,
    dto: CreateStoreInviteDto,
  ) {
    if (dto.role === StoreMemberRole.OWNER) {
      throw new ForbiddenException('Use onboarding to assign store owners');
    }

    const storeSummary = await this.storeMembershipsService.findStoreForUser(
      userId,
      storeId,
    );

    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      const membership = await this.storeMembershipsService.getMembership(
        existingUser.id,
        storeId,
      );
      if (membership) {
        throw new ConflictException('User is already a member of this store');
      }
    }

    const { invite, token } = await this.invitesService.createInvite({
      email: dto.email,
      storeId,
      organizationId: storeSummary.organizationId,
      role: dto.role,
      invitedBy: userId,
    });

    return {
      invite: this.invitesService.toResponse(invite),
      inviteToken: token,
    };
  }

  async listStoreInvites(userId: string, storeId: string) {
    await this.storeMembershipsService.findStoreForUser(userId, storeId);
    const invites = await this.invitesService.findPendingForStore(storeId);
    return invites.map((invite) => this.invitesService.toResponse(invite));
  }
}
