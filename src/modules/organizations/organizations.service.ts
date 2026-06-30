import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
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
          userId: new Types.ObjectId(input.ownerId),
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

  async findForUser(userId: string): Promise<OrganizationDocument[]> {
    const memberships = await this.organizationMemberModel
      .find({ userId: new Types.ObjectId(userId) })
      .exec();

    if (memberships.length === 0) {
      return [];
    }

    const organizationIds = memberships.map(
      (membership) => membership.organizationId,
    );

    return this.organizationModel
      .find({ _id: { $in: organizationIds } })
      .sort({ createdAt: -1 })
      .exec();
  }

  async isOwner(userId: string, organizationId: string): Promise<boolean> {
    const membership = await this.organizationMemberModel
      .findOne({
        userId: new Types.ObjectId(userId),
        organizationId: new Types.ObjectId(organizationId),
        role: OrganizationMemberRole.OWNER,
      })
      .exec();

    return Boolean(membership);
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
