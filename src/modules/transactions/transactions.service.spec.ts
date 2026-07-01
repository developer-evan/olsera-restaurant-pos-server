import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus } from '../orders/enums/order.enum';
import { OrdersService } from '../orders/orders.service';
import { PaymentMethod, TransactionStatus } from './enums/transaction.enum';
import { Transaction } from './schemas/transaction.schema';
import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
  let service: TransactionsService;

  const storeId = '507f1f77bcf86cd799439011';
  const organizationId = '507f1f77bcf86cd799439012';
  const orderId = '507f1f77bcf86cd799439013';
  const transactionId = '507f1f77bcf86cd799439014';

  const mockOrder = {
    _id: { toString: () => orderId },
    orderNumber: 'ORD-20260629-0001',
    total: 12.5,
    status: OrderStatus.READY,
  };

  const mockCompletedOrder = {
    ...mockOrder,
    status: OrderStatus.COMPLETED,
    version: 2,
  };

  const mockTransaction = {
    _id: { toString: () => transactionId },
    storeId: { toString: () => storeId },
    organizationId: { toString: () => organizationId },
    orderId: { toString: () => orderId },
    orderNumber: 'ORD-20260629-0001',
    amount: 12.5,
    method: PaymentMethod.CASH,
    status: TransactionStatus.COMPLETED,
    idempotencyKey: 'pay-key-001',
    externalRef: null,
    processedAt: new Date(),
    refundedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSession = {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    abortTransaction: jest.fn(),
    endSession: jest.fn(),
  };

  const mockConnection = {
    startSession: jest.fn().mockResolvedValue(mockSession),
  };

  const mockTransactionModel = {
    create: jest.fn(),
    findOne: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    }),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([mockTransaction]),
          }),
        }),
      }),
    }),
    countDocuments: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(1),
    }),
    findOneAndUpdate: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        ...mockTransaction,
        status: TransactionStatus.REFUNDED,
      }),
    }),
  };

  const mockOrdersService = {
    findByIdForStore: jest.fn().mockResolvedValue(mockOrder),
    completeForPayment: jest.fn().mockResolvedValue(mockCompletedOrder),
    toResponse: jest.fn().mockReturnValue({
      id: orderId,
      status: OrderStatus.COMPLETED,
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockTransactionModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    mockTransactionModel.create.mockResolvedValue([mockTransaction]);
    mockOrdersService.findByIdForStore.mockResolvedValue(mockOrder);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: getConnectionToken(), useValue: mockConnection },
        { provide: getModelToken(Transaction.name), useValue: mockTransactionModel },
        { provide: OrdersService, useValue: mockOrdersService },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  it('pays an order and completes it atomically', async () => {
    const result = await service.payOrder({
      storeId,
      organizationId,
      orderId,
      method: PaymentMethod.CASH,
      idempotencyKey: 'pay-key-001',
    });

    expect(result.transaction.amount).toBe(12.5);
    expect(result.idempotentReplay).toBe(false);
    expect(mockOrdersService.completeForPayment).toHaveBeenCalled();
    expect(mockSession.commitTransaction).toHaveBeenCalled();
  });

  it('returns the same transaction for duplicate idempotency keys', async () => {
    mockTransactionModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockTransaction),
    });

    const result = await service.payOrder({
      storeId,
      organizationId,
      orderId,
      method: PaymentMethod.CASH,
      idempotencyKey: 'pay-key-001',
    });

    expect(result.idempotentReplay).toBe(true);
    expect(mockTransactionModel.create).not.toHaveBeenCalled();
  });

  it('rejects refund when transaction is not completed', async () => {
    mockTransactionModel.findOne.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValue({
        ...mockTransaction,
        status: TransactionStatus.REFUNDED,
      }),
    });

    await expect(service.refund(storeId, transactionId)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws NotFoundException when transaction missing', async () => {
    mockTransactionModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(
      service.findByIdForStore(storeId, transactionId),
    ).rejects.toThrow(NotFoundException);
  });
});
