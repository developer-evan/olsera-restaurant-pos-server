import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InvitesService } from './invites.service';
import { StoreInvite, StoreInviteSchema } from './schemas/store-invite.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StoreInvite.name, schema: StoreInviteSchema },
    ]),
  ],
  providers: [InvitesService],
  exports: [InvitesService],
})
export class InvitesModule {}
