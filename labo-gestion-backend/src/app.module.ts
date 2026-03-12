import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SequelizeModule } from '@nestjs/sequelize/dist/sequelize.module';
import { ItemModule } from './item/item.module';
import { SupplierModule } from './suppliers/suppliers.module';
import { Item } from './item/entities/item.entity';
import { Supplier } from './suppliers/entities/supplier.entity';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { StockMovement } from './stock-movements/entities/stock-movement.entity';
import { StockMovementsModule } from './stock-movements/stock-movements.module';

@Module({
  imports: [
    SequelizeModule.forRoot({
      dialect: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'root',
      database: 'gestion_labo',
      models: [Item, Supplier, StockMovement],
      autoLoadModels: true,
      synchronize: true,
      sync: { alter: true },
    }),
    ItemModule,
    SupplierModule,
    StockMovementsModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
