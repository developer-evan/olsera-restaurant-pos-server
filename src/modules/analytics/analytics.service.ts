import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order } from '../orders/schemas/order.schema';
import { OrderStatus } from '../orders/enums/order.enum';
import { Transaction } from '../transactions/schemas/transaction.schema';
import { TransactionStatus } from '../transactions/enums/transaction.enum';
import {
  AnalyticsOverviewQueryDto,
  AnalyticsRangeQueryDto,
  TopProductsQueryDto,
} from './dto/analytics.dto';

type DateRange = {
  start: Date;
  end: Date;
};

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<Transaction>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<Order>,
  ) {}

  async getOverview(storeId: string, query: AnalyticsOverviewQueryDto) {
    const range = this.resolveSingleDayRange(query.date);
    const metrics = await this.getSalesMetrics(storeId, range);

    return {
      date: this.formatDateKey(range.start),
      ...metrics,
    };
  }

  async getSalesByDay(storeId: string, query: AnalyticsRangeQueryDto) {
    const range = this.resolveRange(query.fromDate, query.toDate, 7);

    const results = await this.transactionModel.aggregate<{
      _id: string;
      sales: number;
      orderCount: number;
    }>([
      {
        $match: {
          storeId: new Types.ObjectId(storeId),
          status: TransactionStatus.COMPLETED,
          createdAt: { $gte: range.start, $lte: range.end },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' },
          },
          sales: { $sum: '$amount' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return {
      fromDate: this.formatDateKey(range.start),
      toDate: this.formatDateKey(range.end),
      points: results.map((point) => ({
        date: point._id,
        sales: this.roundCurrency(point.sales),
        orderCount: point.orderCount,
        avgTicket: point.orderCount
          ? this.roundCurrency(point.sales / point.orderCount)
          : 0,
      })),
    };
  }

  async getTopProducts(storeId: string, query: TopProductsQueryDto) {
    const range = this.resolveRange(query.fromDate, query.toDate, 30);
    const limit = query.limit ?? 10;

    const results = await this.orderModel.aggregate<{
      _id: { productId: Types.ObjectId; name: string };
      quantity: number;
      revenue: number;
    }>([
      {
        $match: {
          storeId: new Types.ObjectId(storeId),
          status: OrderStatus.COMPLETED,
          completedAt: { $gte: range.start, $lte: range.end },
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: {
            productId: '$items.productId',
            name: '$items.name',
          },
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.lineTotal' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: limit },
    ]);

    return {
      fromDate: this.formatDateKey(range.start),
      toDate: this.formatDateKey(range.end),
      products: results.map((item, index) => ({
        rank: index + 1,
        productId: item._id.productId.toString(),
        name: item._id.name,
        quantity: item.quantity,
        revenue: this.roundCurrency(item.revenue),
      })),
    };
  }

  private async getSalesMetrics(storeId: string, range: DateRange) {
    const [aggregateResult] = await this.transactionModel.aggregate<{
      sales: number;
      orderCount: number;
    }>([
      {
        $match: {
          storeId: new Types.ObjectId(storeId),
          status: TransactionStatus.COMPLETED,
          createdAt: { $gte: range.start, $lte: range.end },
        },
      },
      {
        $group: {
          _id: null,
          sales: { $sum: '$amount' },
          orderCount: { $sum: 1 },
        },
      },
    ]);

    const sales = this.roundCurrency(aggregateResult?.sales ?? 0);
    const orderCount = aggregateResult?.orderCount ?? 0;

    return {
      sales,
      orderCount,
      avgTicket: orderCount ? this.roundCurrency(sales / orderCount) : 0,
    };
  }

  private resolveSingleDayRange(date?: string): DateRange {
    const target = date ? new Date(`${date}T00:00:00.000Z`) : new Date();
    return this.getUtcDayRange(target);
  }

  private resolveRange(
    fromDate: string | undefined,
    toDate: string | undefined,
    fallbackDays: number,
  ): DateRange {
    if (fromDate && toDate) {
      return {
        start: new Date(`${fromDate}T00:00:00.000Z`),
        end: new Date(`${toDate}T23:59:59.999Z`),
      };
    }

    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (fallbackDays - 1));
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(23, 59, 59, 999);

    return { start, end };
  }

  private getUtcDayRange(date: Date): DateRange {
    const start = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    const end = new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );

    return { start, end };
  }

  private formatDateKey(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private roundCurrency(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
