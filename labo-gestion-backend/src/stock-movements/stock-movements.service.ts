import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, WhereOptions } from 'sequelize';
import {
  StockMovement,
  StockMovementType,
} from './entities/stock-movement.entity';

export type StockMovementFilters = {
  itemId?: number;
  supplierId?: number;
  movementType?: StockMovementType;
  from?: string;
  to?: string;
};

@Injectable()
export class StockMovementsService {
  constructor(
    @InjectModel(StockMovement)
    private readonly stockMovementModel: typeof StockMovement,
  ) {}

  async findAll(filters: StockMovementFilters = {}): Promise<StockMovement[]> {
    const where: WhereOptions<StockMovement> = {};

    if (filters.itemId !== undefined) {
      where.itemId = filters.itemId;
    }

    if (filters.supplierId !== undefined) {
      where.supplierId = filters.supplierId;
    }

    if (filters.movementType !== undefined) {
      where.movementType = filters.movementType;
    }

    const createdAtRange = this.buildCreatedAtRange(filters.from, filters.to);

    if (createdAtRange) {
      where.createdAt = createdAtRange;
    }

    return this.stockMovementModel.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });
  }

  private buildCreatedAtRange(from?: string, to?: string) {
    if (!from && !to) {
      return null;
    }

    const range: Record<symbol, Date> = {};

    if (from) {
      range[Op.gte] = new Date(`${from}T00:00:00.000`);
    }

    if (to) {
      range[Op.lte] = new Date(`${to}T23:59:59.999`);
    }

    return range;
  }
}