import {
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Connection } from 'mongoose';
import { OrganizationsService } from '../organizations/organizations.service';
import { StoresService } from '../stores/stores.service';
import { UsersService } from '../users/users.service';
import { OnboardTenantDto } from './dto/onboard-tenant.dto';

@Injectable()
export class PlatformService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly usersService: UsersService,
    private readonly organizationsService: OrganizationsService,
    private readonly storesService: StoresService,
  ) {}

  async onboardTenant(dto: OnboardTenantDto) {
    const existingOwner = await this.usersService.findByEmail(dto.owner.email);
    if (existingOwner) {
      throw new ConflictException('Owner email is already registered');
    }

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const passwordHash = await bcrypt.hash(dto.owner.password, 10);
      const owner = await this.usersService.create(
        {
          email: dto.owner.email,
          passwordHash,
          firstName: dto.owner.firstName,
          lastName: dto.owner.lastName,
        },
        session,
      );

      const organization = await this.organizationsService.create({
        name: dto.organization.name,
        ownerId: owner.id,
        session,
      });

      const store = await this.storesService.create({
        organizationId: organization._id.toString(),
        name: dto.store.name,
        ownerId: owner.id,
        currency: dto.store.currency,
        timezone: dto.store.timezone,
        session,
      });

      await session.commitTransaction();

      return {
        owner,
        organization: this.organizationsService.toResponse(organization),
        store: this.storesService.toResponse(store),
      };
    } catch (error) {
      await session.abortTransaction();

      if (error instanceof ConflictException) {
        throw error;
      }

      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException(
          'Organization or store slug already exists. Try a different name.',
        );
      }

      throw error;
    } finally {
      session.endSession();
    }
  }

  async listOrganizations() {
    const organizations = await this.organizationsService.findAll();
    return organizations.map((organization) =>
      this.organizationsService.toResponse(organization),
    );
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: number }).code === 11000
    );
  }
}
