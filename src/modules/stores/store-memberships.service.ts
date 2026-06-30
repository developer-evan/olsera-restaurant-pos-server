import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { StoreMemberRole } from '../organizations/enums/organization.enum';
import { StoreMembership } from './schemas/store-membership.schema';
import { Store, StoreDocument } from './schemas/store.schema';
import { CreateStoreInput, StoresService } from './stores.service';
import { UserStoreSummary } from '../tenant/types/tenant.types';

@Injectable()
export class StoreMembershipsService {
  constructor(
    @InjectModel(Store.name) private readonly storeModel: Model<Store>,
    @InjectModel(StoreMembership.name)
    private readonly storeMembershipModel: Model<StoreMembership>,
    private readonly storesService: StoresService,
  ) {}

  async findStoresForUser(userId: string): Promise<UserStoreSummary[]> {
    const memberships = await this.storeMembershipModel
      .find({ userId: new Types.ObjectId(userId) })
      .exec();

    if (memberships.length === 0) {
      return [];
    }

    const storeIds = memberships.map((membership) => membership.storeId);
    const stores = await this.storeModel.find({ _id: { $in: storeIds } }).exec();

    const membershipByStoreId = new Map(
      memberships.map((membership) => [
        membership.storeId.toString(),
        membership.role,
      ]),
    );

    return stores.map((store) => ({
      ...this.storesService.toResponse(store),
      role: membershipByStoreId.get(store._id.toString()) as StoreMemberRole,
    }));
  }

  async getMembership(userId: string, storeId: string) {
    return this.storeMembershipModel
      .findOne({
        userId: new Types.ObjectId(userId),
        storeId: new Types.ObjectId(storeId),
      })
      .exec();
  }

  async canManageStore(userId: string, storeId: string): Promise<boolean> {
    const membership = await this.getMembership(userId, storeId);
    return membership?.role === StoreMemberRole.OWNER;
  }

  async addMember(input: {
    userId: string;
    storeId: string;
    organizationId: string;
    role: StoreMemberRole;
  }): Promise<void> {
    await this.storeMembershipModel.create([
      {
        userId: new Types.ObjectId(input.userId),
        storeId: new Types.ObjectId(input.storeId),
        organizationId: new Types.ObjectId(input.organizationId),
        role: input.role,
      },
    ]);
  }

  async findStoreForUser(
    userId: string,
    storeId: string,
  ): Promise<UserStoreSummary> {
    const membership = await this.getMembership(userId, storeId);
    if (!membership) {
      throw new NotFoundException('Store not found');
    }

    const store = await this.storeModel.findById(storeId).exec();
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    return {
      ...this.storesService.toResponse(store),
      role: membership.role,
    };
  }

  createStore(input: CreateStoreInput): Promise<StoreDocument> {
    return this.storesService.create(input);
  }

  async updateStore(
    storeId: string,
    updates: Partial<Pick<Store, 'name' | 'currency' | 'timezone' | 'status'>>,
  ): Promise<StoreDocument> {
    const store = await this.storeModel
      .findByIdAndUpdate(storeId, updates, { new: true })
      .exec();

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    return store;
  }
}
