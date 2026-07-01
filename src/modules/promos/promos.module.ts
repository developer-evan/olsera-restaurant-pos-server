import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PromosController } from './promos.controller';
import { PromosService } from './promos.service';
import { Promo, PromoSchema } from './schemas/promo.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Promo.name, schema: PromoSchema }]),
  ],
  controllers: [PromosController],
  providers: [PromosService],
  exports: [PromosService],
})
export class PromosModule {}
