import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { buildUniqueSlug } from '../../common/utils/slug.util';
import {
  OrganizationMemberRole,
  OrganizationStatus,
} from './enums/organization.enum';
import {
  OrganizationMember,
  OrganizationMemberDocument,
} from './schemas/organization-member.schema';
import {
  Organization,
  OrganizationDocument,
} from './schemas/organization.schema';

export type CreateOrganizationInput = {
  name: string;
  ownerId: string;
  session?: ClientSession;
};

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectModel(Organization.name)
    private readonly organizationModel: Model<Organization>,
    @InjectModel(OrganizationMember.name)
    private readonly organizationMemberModel: Model<OrganizationMember>,
  ) {}

  async create(input: CreateOrganizationInput): Promise<OrganizationDocument> {
    const slug = await buildUniqueSlug(input.name, (value) =>
      this.organizationModel.exists({ slug: value }).then(Boolean),
    );

    const [organization] = await this.organizationModel.create(
      [
        {
          name: input.name,
          slug,
          ownerId: input.ownerId,
          status: OrganizationStatus.ACTIVE,
        },
      ],
      { session: input.session },
    );

    await this.organizationMemberModel.create(
      [
        {
          userId: input.ownerId,
          organizationId: organization._id,
          role: OrganizationMemberRole.OWNER,
        },
      ],
      { session: input.session },
    );

    return organization;
  }

  async findAll(): Promise<OrganizationDocument[]> {
    return this.organizationModel.find().sort({ createdAt: -1 }).exec();
  }

  async findById(id: string): Promise<OrganizationDocument | null> {
    return this.organizationModel.findById(id).exec();
  }

  async slugExists(slug: string): Promise<boolean> {
    return this.organizationModel.exists({ slug }).then(Boolean);
  }

  toResponse(organization: OrganizationDocument) {
    return {
      id: organization._id.toString(),
      name: organization.name,
      slug: organization.slug,
      ownerId: organization.ownerId.toString(),
      status: organization.status,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
    };
  }
}
