import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ItemService } from './item.service';
import { ItemController } from './item.controller';
import { Item } from './entities/item.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { StockMovement } from '../stock-movements/entities/stock-movement.entity';

@Module({
  imports: [SequelizeModule.forFeature([Item, Supplier, StockMovement])],
  controllers: [ItemController],
  providers: [ItemService],
  exports: [SequelizeModule],
})
export class ItemModule {}
