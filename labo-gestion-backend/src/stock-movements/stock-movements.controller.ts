import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  STOCK_MOVEMENT_TYPES,
  StockMovementType,
} from './entities/stock-movement.entity';
import {
  StockMovementFilters,
  StockMovementsService,
} from './stock-movements.service';

@UseGuards(JwtAuthGuard)
@Controller('stock-movements')
export class StockMovementsController {
  constructor(private readonly stockMovementsService: StockMovementsService) {}

  @Get()
  findAll(
    @Query('itemId') itemId?: string,
    @Query('supplierId') supplierId?: string,
    @Query('movementType') movementType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const filters: StockMovementFilters = {};

    if (itemId !== undefined && itemId.length > 0) {
      filters.itemId = this.parseNumericQuery(itemId, 'itemId');
    }

    if (supplierId !== undefined && supplierId.length > 0) {
      filters.supplierId = this.parseNumericQuery(supplierId, 'supplierId');
    }

    if (movementType !== undefined && movementType.length > 0) {
      if (!STOCK_MOVEMENT_TYPES.includes(movementType as StockMovementType)) {
        throw new BadRequestException(
          `Le type de mouvement ${movementType} est invalide.`,
        );
      }

      filters.movementType = movementType as StockMovementType;
    }

    if (from) {
      this.parseDateQuery(from, 'from');
      filters.from = from;
    }

    if (to) {
      this.parseDateQuery(to, 'to');
      filters.to = to;
    }

    return this.stockMovementsService.findAll(filters);
  }

  private parseNumericQuery(value: string, fieldName: string) {
    const parsedValue = Number.parseInt(value, 10);

    if (Number.isNaN(parsedValue)) {
      throw new BadRequestException(`Le paramètre ${fieldName} est invalide.`);
    }

    return parsedValue;
  }

  private parseDateQuery(value: string, fieldName: string) {
    const parsedDate = new Date(`${value}T00:00:00.000`);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException(`Le paramètre ${fieldName} est invalide.`);
    }
  }
}