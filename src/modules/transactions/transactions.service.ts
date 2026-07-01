import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { PaginationMetaDto } from '../../common/dto/api-response.dto';
import { OrdersService } from '../orders/orders.service';
import {
  ListTransactionsQueryDto,
  PayOrderDto,
} from './dto/transaction.dto';
import {
  TransactionStatus,
} from './enums/transaction.enum';
import { Transaction, TransactionDocument } from './schemas/transaction.schema';

export type PayOrderInput = PayOrderDto & {
  storeId: string;
  organizationId: string;
  orderId: string;
  createdBy?: string;
};

type PayOrderResult = {
  transaction: ReturnType<TransactionsService['toResponse']>;
  order: ReturnType<OrdersService['toResponse']>;
  idempotentReplay: boolean;
};

@Injectable()
export class TransactionsService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<Transaction>,
    private readonly ordersService: OrdersService,
  ) {}

  async payOrder(input: PayOrderInput): Promise<PayOrderResult> {
    const existing = await this.findByIdempotencyKey(
      input.storeId,
      input.idempotencyKey,
    );

    if (existing) {
      const order = await this.ordersService.findByIdForStore(
        input.storeId,
        existing.orderId.toString(),
      );

      return {
        transaction: this.toResponse(existing),
        order: this.ordersService.toResponse(order),
        idempotentReplay: true,
      };
    }

    const order = await this.ordersService.findByIdForStore(
      input.storeId,
      input.orderId,
    );

    const existingPayment = await this.transactionModel
      .findOne({
        storeId: new Types.ObjectId(input.storeId),
        orderId: order._id,
        status: TransactionStatus.COMPLETED,
      })
      .exec();

    if (existingPayment) {
      throw new BadRequestException('Order has already been paid');
    }

    if (order.total <= 0) {
      throw new BadRequestException('Order total must be greater than zero');
    }

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const completedOrder = await this.ordersService.completeForPayment(
        input.storeId,
        input.orderId,
        input.createdBy,
        session,
      );

      const [transaction] = await this.transactionModel.create(
        [
          {
            storeId: new Types.ObjectId(input.storeId),
            organizationId: new Types.ObjectId(input.organizationId),
            orderId: order._id,
            orderNumber: order.orderNumber,
            amount: order.total,
            method: input.method,
            status: TransactionStatus.COMPLETED,
            idempotencyKey: input.idempotencyKey,
            externalRef: input.externalRef ?? null,
            processedAt: new Date(),
            createdBy: input.createdBy
              ? new Types.ObjectId(input.createdBy)
              : null,
          },
        ],
        { session },
      );

      await session.commitTransaction();

      return {
        transaction: this.toResponse(transaction),
        order: this.ordersService.toResponse(completedOrder),
        idempotentReplay: false,
      };
    } catch (error) {
      await session.abortTransaction();

      if (this.isDuplicateKeyError(error)) {
        const replay = await this.findByIdempotencyKey(
          input.storeId,
          input.idempotencyKey,
        );

        if (replay) {
          const replayOrder = await this.ordersService.findByIdForStore(
            input.storeId,
            replay.orderId.toString(),
          );

          return {
            transaction: this.toResponse(replay),
            order: this.ordersService.toResponse(replayOrder),
            idempotentReplay: true,
          };
        }
      }

      throw error;
    } finally {
      session.endSession();
    }
  }

  async findAllForStore(storeId: string, filters: ListTransactionsQueryDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;
    const query: Record<string, unknown> = {
      storeId: new Types.ObjectId(storeId),
    };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.method) {
      query.method = filters.method;
    }

    if (filters.fromDate || filters.toDate) {
      query.createdAt = {};
      if (filters.fromDate) {
        (query.createdAt as Record<string, Date>).$gte = filters.fromDate;
      }
      if (filters.toDate) {
        (query.createdAt as Record<string, Date>).$lte = filters.toDate;
      }
    }

    const [transactions, total] = await Promise.all([
      this.transactionModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.transactionModel.countDocuments(query).exec(),
    ]);

    const meta: PaginationMetaDto = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    };

    return {
      success: true as const,
      data: transactions.map((transaction) => this.toResponse(transaction)),
      meta,
    };
  }

  async findByIdForStore(
    storeId: string,
    transactionId: string,
  ): Promise<TransactionDocument> {
    const transaction = await this.transactionModel
      .findOne({
        _id: transactionId,
        storeId: new Types.ObjectId(storeId),
      })
      .exec();

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
  }

  async refund(
    storeId: string,
    transactionId: string,
    updatedBy?: string,
  ): Promise<TransactionDocument> {
    const transaction = await this.findByIdForStore(storeId, transactionId);

    if (transaction.status !== TransactionStatus.COMPLETED) {
      throw new BadRequestException('Only completed transactions can be refunded');
    }

    const updated = await this.transactionModel
      .findOneAndUpdate(
        {
          _id: transaction._id,
          storeId: new Types.ObjectId(storeId),
          status: TransactionStatus.COMPLETED,
        },
        {
          status: TransactionStatus.REFUNDED,
          refundedAt: new Date(),
          updatedBy: updatedBy ? new Types.ObjectId(updatedBy) : null,
        },
        { new: true },
      )
      .exec();

    if (!updated) {
      throw new BadRequestException('Transaction could not be refunded');
    }

    return updated;
  }

  toResponse(transaction: TransactionDocument) {
    return {
      id: transaction._id.toString(),
      storeId: transaction.storeId.toString(),
      organizationId: transaction.organizationId.toString(),
      orderId: transaction.orderId.toString(),
      orderNumber: transaction.orderNumber,
      amount: transaction.amount,
      method: transaction.method,
      status: transaction.status,
      idempotencyKey: transaction.idempotencyKey,
      externalRef: transaction.externalRef ?? null,
      processedAt: transaction.processedAt,
      refundedAt: transaction.refundedAt,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
  }

  private async findByIdempotencyKey(
    storeId: string,
    idempotencyKey: string,
  ): Promise<TransactionDocument | null> {
    return this.transactionModel
      .findOne({
        storeId: new Types.ObjectId(storeId),
        idempotencyKey,
      })
      .exec();
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: number }).code === 11000
    );
  }
}
