import { ConflictException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { Category } from './schemas/category.schema';

describe('CategoriesService', () => {
  let service: CategoriesService;

  const storeId = '507f1f77bcf86cd799439011';
  const organizationId = '507f1f77bcf86cd799439012';
  const categoryId = '507f1f77bcf86cd799439013';

  const mockCategory = {
    _id: { toString: () => categoryId },
    storeId: { toString: () => storeId },
    organizationId: { toString: () => organizationId },
    name: 'Drinks',
    slug: 'drinks',
    sortOrder: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCategoryModel = {
    create: jest.fn(),
    exists: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockCategory]),
      }),
    }),
    findOne: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockCategory),
    }),
    findOneAndUpdate: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockCategory),
    }),
    updateOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: getModelToken(Category.name), useValue: mockCategoryModel },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  it('creates a category with generated slug', async () => {
    mockCategoryModel.create.mockResolvedValue([mockCategory]);

    const result = await service.create({
      name: 'Drinks',
      storeId,
      organizationId,
    });

    expect(result.name).toBe('Drinks');
    expect(mockCategoryModel.create).toHaveBeenCalled();
  });

  it('throws ConflictException on duplicate slug', async () => {
    mockCategoryModel.create.mockRejectedValue({ code: 11000 });

    await expect(
      service.create({
        name: 'Drinks',
        storeId,
        organizationId,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws NotFoundException when category missing', async () => {
    mockCategoryModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(service.findByIdForStore(storeId, categoryId)).rejects.toThrow(
      NotFoundException,
    );
  });
});
