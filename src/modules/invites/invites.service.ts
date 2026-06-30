import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  generateRefreshToken,
  hashToken,
  parseDurationToMs,
} from '../../common/utils/token.util';
import { StoreMemberRole } from '../organizations/enums/organization.enum';
import { StoreInvite, StoreInviteDocument } from './schemas/store-invite.schema';

export type CreateStoreInviteInput = {
  email: string;
  storeId: string;
  organizationId: string;
  role: StoreMemberRole;
  invitedBy: string;
};

@Injectable()
export class InvitesService {
  constructor(
    @InjectModel(StoreInvite.name)
    private readonly storeInviteModel: Model<StoreInvite>,
  ) {}

  async createInvite(
    input: CreateStoreInviteInput,
  ): Promise<{ invite: StoreInviteDocument; token: string }> {
    const token = generateRefreshToken();
    const expiresAt = new Date(Date.now() + parseDurationToMs('7d'));

    const [invite] = await this.storeInviteModel.create([
      {
        email: input.email.toLowerCase(),
        storeId: new Types.ObjectId(input.storeId),
        organizationId: new Types.ObjectId(input.organizationId),
        role: input.role,
        tokenHash: hashToken(token),
        invitedBy: new Types.ObjectId(input.invitedBy),
        expiresAt,
      },
    ]);

    return { invite, token };
  }

  async findPendingForStore(storeId: string): Promise<StoreInviteDocument[]> {
    return this.storeInviteModel
      .find({
        storeId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findValidByToken(token: string): Promise<StoreInviteDocument | null> {
    return this.storeInviteModel
      .findOne({
        tokenHash: hashToken(token),
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      })
      .exec();
  }

  async markAccepted(inviteId: string): Promise<void> {
    await this.storeInviteModel
      .updateOne({ _id: inviteId }, { acceptedAt: new Date() })
      .exec();
  }

  toResponse(invite: StoreInviteDocument) {
    return {
      id: invite._id.toString(),
      email: invite.email,
      storeId: invite.storeId.toString(),
      organizationId: invite.organizationId.toString(),
      role: invite.role,
      expiresAt: invite.expiresAt,
      acceptedAt: invite.acceptedAt,
      createdAt: invite.createdAt,
    };
  }
}
