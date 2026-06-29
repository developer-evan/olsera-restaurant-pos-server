import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { buildUniqueSlug } from '../../common/utils/slug.util';
import {
  StoreMemberRole,
  StoreStatus,
} from '../organizations/enums/organization.enum';
import { StoreMembership } from './schemas/store-membership.schema';
import { Store, StoreDocument } from './schemas/store.schema';

export type CreateStoreInput = {
  organizationId: string;
  name: string;
  ownerId: string;
  currency?: string;
  timezone?: string;
  session?: ClientSession;
};

@Injectable()
export class StoresService {
  constructor(
    @InjectModel(Store.name) private readonly storeModel: Model<Store>,
    @InjectModel(StoreMembership.name)
    private readonly storeMembershipModel: Model<StoreMembership>,
  ) {}

  async create(input: CreateStoreInput): Promise<StoreDocument> {
    const slug = await buildUniqueSlug(input.name, (value) =>
      this.storeModel
        .exists({ organizationId: input.organizationId, slug: value })
        .then(Boolean),
    );

    const [store] = await this.storeModel.create(
      [
        {
          organizationId: input.organizationId,
          name: input.name,
          slug,
          currency: input.currency ?? 'USD',
          timezone: input.timezone ?? 'UTC',
          status: StoreStatus.ACTIVE,
        },
      ],
      { session: input.session },
    );

    await this.storeMembershipModel.create(
      [
        {
          userId: input.ownerId,
          storeId: store._id,
          organizationId: input.organizationId,
          role: StoreMemberRole.OWNER,
        },
      ],
      { session: input.session },
    );

    return store;
  }

  toResponse(store: StoreDocument) {
    return {
      id: store._id.toString(),
      organizationId: store.organizationId.toString(),
      name: store.name,
      slug: store.slug,
      currency: store.currency,
      timezone: store.timezone,
      status: store.status,
      createdAt: store.createdAt,
      updatedAt: store.updatedAt,
    };
  }
}
