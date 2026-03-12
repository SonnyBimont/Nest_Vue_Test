import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { StockMovement } from './entities/stock-movement.entity';
import { StockMovementsController } from './stock-movements.controller';
import { StockMovementsService } from './stock-movements.service';

@Module({
  imports: [SequelizeModule.forFeature([StockMovement])],
  controllers: [StockMovementsController],
  providers: [StockMovementsService],
  exports: [SequelizeModule, StockMovementsService],
})
export class StockMovementsModule {}