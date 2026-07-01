import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Order } from '../orders/schemas/order.schema';
import { Transaction } from '../transactions/schemas/transaction.schema';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  const storeId = '507f1f77bcf86cd799439011';

  const mockTransactionModel = {
    aggregate: jest.fn(),
  };

  const mockOrderModel = {
    aggregate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getModelToken(Transaction.name), useValue: mockTransactionModel },
        { provide: getModelToken(Order.name), useValue: mockOrderModel },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  it('returns overview metrics for a day', async () => {
    mockTransactionModel.aggregate.mockResolvedValue([
      { sales: 100, orderCount: 4 },
    ]);

    const result = await service.getOverview(storeId, { date: '2026-06-29' });

    expect(result.date).toBe('2026-06-29');
    expect(result.sales).toBe(100);
    expect(result.orderCount).toBe(4);
    expect(result.avgTicket).toBe(25);
  });

  it('returns zero metrics when there is no sales data', async () => {
    mockTransactionModel.aggregate.mockResolvedValue([]);

    const result = await service.getOverview(storeId, { date: '2026-06-29' });

    expect(result.sales).toBe(0);
    expect(result.orderCount).toBe(0);
    expect(result.avgTicket).toBe(0);
  });

  it('returns sales grouped by day', async () => {
    mockTransactionModel.aggregate.mockResolvedValue([
      { _id: '2026-06-28', sales: 50, orderCount: 2 },
      { _id: '2026-06-29', sales: 75, orderCount: 3 },
    ]);

    const result = await service.getSalesByDay(storeId, {
      fromDate: '2026-06-28',
      toDate: '2026-06-29',
    });

    expect(result.points).toHaveLength(2);
    expect(result.points[1].avgTicket).toBe(25);
  });

  it('returns top products ranked by revenue', async () => {
    mockOrderModel.aggregate.mockResolvedValue([
      {
        _id: {
          productId: { toString: () => '507f1f77bcf86cd799439014' },
          name: 'Cappuccino',
        },
        quantity: 5,
        revenue: 22.5,
      },
    ]);

    const result = await service.getTopProducts(storeId, {
      fromDate: '2026-06-01',
      toDate: '2026-06-30',
      limit: 5,
    });

    expect(result.products[0].name).toBe('Cappuccino');
    expect(result.products[0].rank).toBe(1);
    expect(result.products[0].revenue).toBe(22.5);
  });
});
