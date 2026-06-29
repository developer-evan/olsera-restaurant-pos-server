import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  StoreMembership,
  StoreMembershipSchema,
} from './schemas/store-membership.schema';
import { Store, StoreSchema } from './schemas/store.schema';
import { StoresService } from './stores.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Store.name, schema: StoreSchema },
      { name: StoreMembership.name, schema: StoreMembershipSchema },
    ]),
  ],
  providers: [StoresService],
  exports: [StoresService],
})
export class StoresModule {}
