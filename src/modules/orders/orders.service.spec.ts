import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from '../products/products.service';
import { PromosService } from '../promos/promos.service';
import { OrderStatus } from './enums/order.enum';
import { OrdersService } from './orders.service';
import { Order } from './schemas/order.schema';

describe('OrdersService', () => {
  let service: OrdersService;

  const storeId = '507f1f77bcf86cd799439011';
  const organizationId = '507f1f77bcf86cd799439012';
  const orderId = '507f1f77bcf86cd799439013';
  const productId = '507f1f77bcf86cd799439014';

  const mockOrder = {
    _id: { toString: () => orderId },
    storeId: { toString: () => storeId },
    organizationId: { toString: () => organizationId },
    orderNumber: 'ORD-20260629-0001',
    status: OrderStatus.DRAFT,
    items: [
      {
        _id: { toString: () => '507f1f77bcf86cd799439015' },
        productId: { toString: () => productId },
        name: 'Cappuccino',
        sku: null,
        quantity: 2,
        unitPrice: 4.5,
        lineTotal: 9,
        notes: '',
      },
    ],
    subtotal: 9,
    taxRate: 0,
    taxAmount: 0,
    discountAmount: 0,
    promoId: null,
    promoCode: null,
    total: 9,
    notes: '',
    version: 1,
    completedAt: null,
    cancelledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockOrderModel = {
    create: jest.fn(),
    countDocuments: jest.fn().mockResolvedValue(0),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      }),
    }),
    findOne: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockOrder),
    }),
    findOneAndUpdate: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.OPEN,
        version: 2,
      }),
    }),
  };

  const mockProductsService = {
    findByIdForStore: jest.fn().mockResolvedValue({
      _id: productId,
      name: 'Cappuccino',
      sku: null,
      price: 4.5,
      isActive: true,
    }),
  };

  const mockPromosService = {
    validatePromo: jest.fn(),
    incrementUsedCount: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockOrderModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockOrder),
    });
    mockOrderModel.create.mockResolvedValue([mockOrder]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getModelToken(Order.name), useValue: mockOrderModel },
        { provide: ProductsService, useValue: mockProductsService },
        { provide: PromosService, useValue: mockPromosService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('creates an order with snapshotted line items', async () => {
    const result = await service.create({
      storeId,
      organizationId,
      items: [{ productId, quantity: 2 }],
    });

    expect(result.orderNumber).toMatch(/^ORD-\d{8}-\d{4}$/);
    expect(mockOrderModel.create).toHaveBeenCalled();
    expect(mockProductsService.findByIdForStore).toHaveBeenCalledWith(
      storeId,
      productId,
    );
  });

  it('rejects invalid status transitions', async () => {
    await expect(
      service.updateStatus(
        storeId,
        orderId,
        { status: OrderStatus.COMPLETED, version: 1 },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws ConflictException on version mismatch', async () => {
    await expect(
      service.updateStatus(
        storeId,
        orderId,
        { status: OrderStatus.OPEN, version: 99 },
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('throws NotFoundException when order missing', async () => {
    mockOrderModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(service.findByIdForStore(storeId, orderId)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('increments promo usage when completing an order', async () => {
    mockOrderModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.READY,
        promoId: { toString: () => '507f1f77bcf86cd799439099' },
      }),
    });
    mockOrderModel.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.COMPLETED,
      }),
    });

    await service.updateStatus(
      storeId,
      orderId,
      { status: OrderStatus.COMPLETED, version: 1 },
    );

    expect(mockPromosService.incrementUsedCount).toHaveBeenCalledWith(
      storeId,
      '507f1f77bcf86cd799439099',
    );
  });
});
