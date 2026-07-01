import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { PaginationMetaDto } from '../../common/dto/api-response.dto';
import { ProductsService } from '../products/products.service';
import { PromosService } from '../promos/promos.service';
import {
  CreateOrderDto,
  OrderLineItemDto,
  UpdateOrderItemsDto,
  UpdateOrderStatusDto,
} from './dto/order.dto';
import {
  ORDER_ITEM_EDITABLE_STATUSES,
  ORDER_STATUS_TRANSITIONS,
  OrderStatus,
} from './enums/order.enum';
import { Order, OrderDocument, OrderItem } from './schemas/order.schema';

export type CreateOrderInput = CreateOrderDto & {
  storeId: string;
  organizationId: string;
  createdBy?: string;
};

type ListOrdersFilters = {
  status?: OrderStatus;
  fromDate?: Date;
  toDate?: Date;
  page?: number;
  limit?: number;
};

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<Order>,
    private readonly productsService: ProductsService,
    private readonly promosService: PromosService,
  ) {}

  async create(input: CreateOrderInput): Promise<OrderDocument> {
    const status = input.status ?? OrderStatus.DRAFT;

    if (status !== OrderStatus.DRAFT && status !== OrderStatus.OPEN) {
      throw new BadRequestException('New orders must start as draft or open');
    }

    const items = await this.buildItems(input.storeId, input.items ?? []);
    const taxRate = input.taxRate ?? 0;
    const totals = await this.calculateTotals(
      input.storeId,
      items,
      taxRate,
      input.promoCode,
    );

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const orderNumber = await this.generateOrderNumber(input.storeId);

      try {
        const [order] = await this.orderModel.create([
          {
            storeId: new Types.ObjectId(input.storeId),
            organizationId: new Types.ObjectId(input.organizationId),
            orderNumber,
            status,
            items,
            subtotal: totals.subtotal,
            taxRate: totals.taxRate,
            taxAmount: totals.taxAmount,
            discountAmount: totals.discountAmount,
            promoId: totals.promoId,
            promoCode: totals.promoCode,
            total: totals.total,
            notes: input.notes ?? '',
            version: 1,
            createdBy: input.createdBy
              ? new Types.ObjectId(input.createdBy)
              : null,
          },
        ]);

        return order;
      } catch (error) {
        if (this.isDuplicateKeyError(error)) {
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException('Unable to generate a unique order number');
  }

  async findAllForStore(storeId: string, filters: ListOrdersFilters) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;
    const query: Record<string, unknown> = {
      storeId: new Types.ObjectId(storeId),
    };

    if (filters.status) {
      query.status = filters.status;
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

    const [orders, total] = await Promise.all([
      this.orderModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.orderModel.countDocuments(query).exec(),
    ]);

    const meta: PaginationMetaDto = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    };

    return {
      success: true as const,
      data: orders.map((order) => this.toResponse(order)),
      meta,
    };
  }

  async findByIdForStore(
    storeId: string,
    orderId: string,
  ): Promise<OrderDocument> {
    const order = await this.orderModel
      .findOne({
        _id: orderId,
        storeId: new Types.ObjectId(storeId),
      })
      .exec();

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async updateItems(
    storeId: string,
    orderId: string,
    dto: UpdateOrderItemsDto,
    updatedBy?: string,
  ): Promise<OrderDocument> {
    const order = await this.findByIdForStore(storeId, orderId);
    this.assertVersion(order, dto.version);

    if (!ORDER_ITEM_EDITABLE_STATUSES.includes(order.status)) {
      throw new BadRequestException(
        'Items can only be modified while the order is draft or open',
      );
    }

    const items = await this.buildItems(storeId, dto.items);
    const taxRate = dto.taxRate ?? order.taxRate;
    const totals = await this.calculateTotals(
      storeId,
      items,
      taxRate,
      dto.promoCode ?? order.promoCode ?? undefined,
    );

    const updated = await this.orderModel
      .findOneAndUpdate(
        {
          _id: order._id,
          storeId: new Types.ObjectId(storeId),
          version: dto.version,
        },
        {
          items,
          subtotal: totals.subtotal,
          taxRate: totals.taxRate,
          taxAmount: totals.taxAmount,
          discountAmount: totals.discountAmount,
          promoId: totals.promoId,
          promoCode: totals.promoCode,
          total: totals.total,
          updatedBy: updatedBy ? new Types.ObjectId(updatedBy) : null,
          $inc: { version: 1 },
        },
        { new: true },
      )
      .exec();

    if (!updated) {
      throw new ConflictException(
        'Order was updated by another request. Refresh and try again.',
      );
    }

    return updated;
  }

  async updateStatus(
    storeId: string,
    orderId: string,
    dto: UpdateOrderStatusDto,
    updatedBy?: string,
  ): Promise<OrderDocument> {
    const order = await this.findByIdForStore(storeId, orderId);
    this.assertVersion(order, dto.version);
    this.assertStatusTransition(order.status, dto.status);

    if (dto.status === OrderStatus.OPEN && order.items.length === 0) {
      throw new BadRequestException('Cannot open an order without items');
    }

    const updates: Partial<Order> = {
      status: dto.status,
      updatedBy: updatedBy ? new Types.ObjectId(updatedBy) : null,
    };

    if (dto.status === OrderStatus.COMPLETED) {
      updates.completedAt = new Date();
      if (order.promoId) {
        await this.promosService.incrementUsedCount(
          storeId,
          order.promoId.toString(),
        );
      }
    }

    if (dto.status === OrderStatus.CANCELLED) {
      updates.cancelledAt = new Date();
    }

    const updated = await this.orderModel
      .findOneAndUpdate(
        {
          _id: order._id,
          storeId: new Types.ObjectId(storeId),
          version: dto.version,
        },
        {
          ...updates,
          $inc: { version: 1 },
        },
        { new: true },
      )
      .exec();

    if (!updated) {
      throw new ConflictException(
        'Order was updated by another request. Refresh and try again.',
      );
    }

    return updated;
  }

  async completeForPayment(
    storeId: string,
    orderId: string,
    updatedBy?: string,
    session?: ClientSession,
  ): Promise<OrderDocument> {
    const order = await this.orderModel
      .findOne({
        _id: orderId,
        storeId: new Types.ObjectId(storeId),
      })
      .session(session ?? null)
      .exec();

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status === OrderStatus.COMPLETED) {
      throw new BadRequestException('Order is already completed');
    }

    if (
      order.status !== OrderStatus.OPEN &&
      order.status !== OrderStatus.READY
    ) {
      throw new BadRequestException('Order is not ready for payment');
    }

    const updated = await this.orderModel
      .findOneAndUpdate(
        {
          _id: order._id,
          storeId: new Types.ObjectId(storeId),
          status: { $in: [OrderStatus.OPEN, OrderStatus.READY] },
        },
        {
          status: OrderStatus.COMPLETED,
          completedAt: new Date(),
          updatedBy: updatedBy ? new Types.ObjectId(updatedBy) : null,
          $inc: { version: 1 },
        },
        { new: true, session },
      )
      .exec();

    if (!updated) {
      throw new BadRequestException('Order is not ready for payment');
    }

    if (order.promoId) {
      await this.promosService.incrementUsedCount(
        storeId,
        order.promoId.toString(),
      );
    }

    return updated;
  }

  toResponse(order: OrderDocument) {
    return {
      id: order._id.toString(),
      storeId: order.storeId.toString(),
      organizationId: order.organizationId.toString(),
      orderNumber: order.orderNumber,
      status: order.status,
      items: order.items.map((item) => this.toItemResponse(item)),
      subtotal: order.subtotal,
      taxRate: order.taxRate,
      taxAmount: order.taxAmount,
      discountAmount: order.discountAmount,
      promoId: order.promoId?.toString() ?? null,
      promoCode: order.promoCode ?? null,
      total: order.total,
      notes: order.notes,
      version: order.version,
      completedAt: order.completedAt,
      cancelledAt: order.cancelledAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  private toItemResponse(item: OrderItem & { _id?: Types.ObjectId }) {
    return {
      id: item._id?.toString(),
      productId: item.productId.toString(),
      name: item.name,
      sku: item.sku ?? null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      notes: item.notes ?? '',
    };
  }

  private async buildItems(
    storeId: string,
    items: OrderLineItemDto[],
  ): Promise<OrderItem[]> {
    if (items.length === 0) {
      return [];
    }

    const builtItems: OrderItem[] = [];

    for (const item of items) {
      const product = await this.productsService.findByIdForStore(
        storeId,
        item.productId,
      );

      if (!product.isActive) {
        throw new BadRequestException(`Product ${product.name} is not available`);
      }

      const unitPrice = product.price;
      builtItems.push({
        productId: product._id,
        name: product.name,
        sku: product.sku ?? null,
        quantity: item.quantity,
        unitPrice,
        lineTotal: this.roundCurrency(unitPrice * item.quantity),
        notes: item.notes ?? '',
      });
    }

    return builtItems;
  }

  private async calculateTotals(
    storeId: string,
    items: OrderItem[],
    taxRate: number,
    promoCode?: string,
  ) {
    const subtotal = this.roundCurrency(
      items.reduce((sum, item) => sum + item.lineTotal, 0),
    );

    let discountAmount = 0;
    let promoId: Types.ObjectId | null = null;
    let resolvedPromoCode: string | null = null;

    if (promoCode && subtotal > 0) {
      const validation = await this.promosService.validatePromo(
        storeId,
        promoCode,
        subtotal,
      );
      discountAmount = validation.discountAmount;
      promoId = new Types.ObjectId(validation.promo.id);
      resolvedPromoCode = validation.promo.code;
    }

    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const taxAmount = this.roundCurrency(taxableAmount * (taxRate / 100));
    const total = this.roundCurrency(taxableAmount + taxAmount);

    return {
      subtotal,
      taxRate,
      taxAmount,
      discountAmount,
      promoId,
      promoCode: resolvedPromoCode,
      total,
    };
  }

  private async generateOrderNumber(storeId: string): Promise<string> {
    const dateStr = this.formatOrderDate(new Date());
    const prefix = `ORD-${dateStr}-`;

    const count = await this.orderModel.countDocuments({
      storeId: new Types.ObjectId(storeId),
      orderNumber: { $regex: `^${prefix}` },
    });

    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  private formatOrderDate(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  private assertVersion(order: OrderDocument, version: number): void {
    if (order.version !== version) {
      throw new ConflictException(
        'Order was updated by another request. Refresh and try again.',
      );
    }
  }

  private assertStatusTransition(
    currentStatus: OrderStatus,
    nextStatus: OrderStatus,
  ): void {
    if (currentStatus === nextStatus) {
      throw new BadRequestException('Order is already in the requested status');
    }

    const allowed = ORDER_STATUS_TRANSITIONS[currentStatus];

    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(
        `Cannot transition order from ${currentStatus} to ${nextStatus}`,
      );
    }
  }

  private roundCurrency(value: number): number {
    return Math.round(value * 100) / 100;
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
