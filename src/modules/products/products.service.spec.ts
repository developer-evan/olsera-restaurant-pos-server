import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from '../categories/categories.service';
import { ProductsService } from './products.service';
import { Product } from './schemas/product.schema';

describe('ProductsService', () => {
  let service: ProductsService;

  const storeId = '507f1f77bcf86cd799439011';
  const organizationId = '507f1f77bcf86cd799439012';
  const categoryId = '507f1f77bcf86cd799439013';
  const productId = '507f1f77bcf86cd799439014';

  const mockProduct = {
    _id: { toString: () => productId },
    storeId: { toString: () => storeId },
    organizationId: { toString: () => organizationId },
    categoryId: { toString: () => categoryId },
    name: 'Cappuccino',
    slug: 'cappuccino',
    description: '',
    sku: null,
    price: 4.5,
    sortOrder: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProductModel = {
    create: jest.fn(),
    exists: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockProduct]),
      }),
    }),
    findOne: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockProduct),
    }),
    findOneAndUpdate: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockProduct),
    }),
    updateOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
  };

  const mockCategoriesService = {
    findByIdForStore: jest.fn().mockResolvedValue({ _id: categoryId }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCategoriesService.findByIdForStore.mockResolvedValue({ _id: categoryId });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getModelToken(Product.name), useValue: mockProductModel },
        { provide: CategoriesService, useValue: mockCategoriesService },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('creates a product with generated slug', async () => {
    mockProductModel.create.mockResolvedValue([mockProduct]);

    const result = await service.create({
      name: 'Cappuccino',
      categoryId,
      price: 4.5,
      storeId,
      organizationId,
    });

    expect(result.name).toBe('Cappuccino');
    expect(mockCategoriesService.findByIdForStore).toHaveBeenCalledWith(
      storeId,
      categoryId,
    );
    expect(mockProductModel.create).toHaveBeenCalled();
  });

  it('throws BadRequestException when category is not in store', async () => {
    mockCategoriesService.findByIdForStore.mockRejectedValue(
      new NotFoundException('Category not found'),
    );

    await expect(
      service.create({
        name: 'Cappuccino',
        categoryId,
        price: 4.5,
        storeId,
        organizationId,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws ConflictException on duplicate slug', async () => {
    mockProductModel.create.mockRejectedValue({ code: 11000 });

    await expect(
      service.create({
        name: 'Cappuccino',
        categoryId,
        price: 4.5,
        storeId,
        organizationId,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws NotFoundException when product missing', async () => {
    mockProductModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(service.findByIdForStore(storeId, productId)).rejects.toThrow(
      NotFoundException,
    );
  });
});
