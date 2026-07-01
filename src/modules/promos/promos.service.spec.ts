import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { PromoType } from './enums/promo.enum';
import { PromosService } from './promos.service';
import { Promo } from './schemas/promo.schema';

describe('PromosService', () => {
  let service: PromosService;

  const storeId = '507f1f77bcf86cd799439011';
  const organizationId = '507f1f77bcf86cd799439012';
  const promoId = '507f1f77bcf86cd799439013';

  const mockPromo = {
    _id: { toString: () => promoId },
    storeId: { toString: () => storeId },
    organizationId: { toString: () => organizationId },
    name: 'Summer Sale',
    code: 'SUMMER20',
    type: PromoType.PERCENTAGE,
    value: 20,
    minOrderAmount: 25,
    maxUses: 100,
    usedCount: 0,
    startsAt: null,
    endsAt: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPromoModel = {
    create: jest.fn(),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockPromo]),
      }),
    }),
    findOne: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockPromo),
    }),
    findOneAndUpdate: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockPromo),
    }),
    updateOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPromoModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockPromo),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromosService,
        { provide: getModelToken(Promo.name), useValue: mockPromoModel },
      ],
    }).compile();

    service = module.get<PromosService>(PromosService);
  });

  it('creates a promo with normalized code', async () => {
    mockPromoModel.create.mockResolvedValue([mockPromo]);

    const result = await service.create({
      name: 'Summer Sale',
      code: 'summer20',
      type: PromoType.PERCENTAGE,
      value: 20,
      minOrderAmount: 25,
      storeId,
      organizationId,
    });

    expect(result.code).toBe('SUMMER20');
    expect(mockPromoModel.create).toHaveBeenCalled();
  });

  it('throws ConflictException on duplicate code', async () => {
    mockPromoModel.create.mockRejectedValue({ code: 11000 });

    await expect(
      service.create({
        name: 'Summer Sale',
        code: 'SUMMER20',
        type: PromoType.PERCENTAGE,
        value: 20,
        storeId,
        organizationId,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('validates percentage promo and calculates discount', async () => {
    const result = await service.validatePromo(storeId, 'SUMMER20', 50);

    expect(result.discountAmount).toBe(10);
    expect(result.totalAfterDiscount).toBe(40);
  });

  it('rejects expired promo', async () => {
    mockPromoModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        ...mockPromo,
        endsAt: new Date('2020-01-01T00:00:00.000Z'),
      }),
    });

    await expect(
      service.validatePromo(storeId, 'SUMMER20', 50),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects promo when usage limit reached', async () => {
    mockPromoModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        ...mockPromo,
        maxUses: 10,
        usedCount: 10,
      }),
    });

    await expect(
      service.validatePromo(storeId, 'SUMMER20', 50),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when promo missing', async () => {
    mockPromoModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(service.findByIdForStore(storeId, promoId)).rejects.toThrow(
      NotFoundException,
    );
  });
});
