import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Item } from './entities/item.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { StockMovement } from '../stock-movements/entities/stock-movement.entity';

type RestockReportItem = {
  id: number;
  name: string;
  internalRef: string | null;
  supplierRef: string | null;
  supplierName: string | null;
  quantity: number;
  stockMax: number | null;
  quantityToRestock: number;
  fillRate: number | null;
  isLowStock: boolean;
};

@Injectable()
export class ItemService {
  private readonly logger = new Logger(ItemService.name);

  // Injection du modèle de la base de données
  constructor(
    @InjectModel(Item)
    private itemModel: typeof Item,
    @InjectModel(Supplier)
    private supplierModel: typeof Supplier,
    @InjectModel(StockMovement)
    private stockMovementModel: typeof StockMovement,
    private sequelize: Sequelize,
  ) {}

  // --- CRUD ---
  async create(createItemDto: CreateItemDto): Promise<Item> {
    return this.itemModel.create({ ...createItemDto });
  }

  async findAll(): Promise<Item[]> {
    return this.itemModel.findAll({ include: [Supplier] });
  }

  async findOne(id: number): Promise<Item> {
    const item = await this.itemModel.findByPk(id, { include: [Supplier] });
    if (!item) {
      throw new NotFoundException(`Consommable avec l'ID #${id} introuvable.`);
    }
    return item;
  }

  async getRestockReport(): Promise<RestockReportItem[]> {
    const items = await this.itemModel.findAll({
      include: [Supplier],
      order: [['name', 'ASC']],
    });

    return items.map((item) => {
      const stockMax = item.stockMax ?? null;
      const quantityToRestock = stockMax ? Math.max(stockMax - item.quantity, 0) : 0;
      const fillRate = stockMax && stockMax > 0
        ? Math.round((Math.min(item.quantity, stockMax) / stockMax) * 100)
        : null;

      return {
        id: item.id,
        name: item.name,
        internalRef: item.internalRef ?? null,
        supplierRef: item.supplierRef ?? null,
        supplierName: item.supplier?.name ?? null,
        quantity: item.quantity,
        stockMax,
        quantityToRestock,
        fillRate,
        isLowStock: item.quantity <= item.lowStockThreshold,
      };
    });
  }

  async update(id: number, updateItemDto: UpdateItemDto): Promise<Item> {
    await this.sequelize.transaction(async (transaction) => {
      const item = await this.itemModel.findByPk(id, {
        include: [Supplier],
        transaction,
      });

      if (!item) {
        throw new NotFoundException(`Consommable avec l'ID #${id} introuvable.`);
      }

      const quantityBefore = item.quantity;

      await item.update({ ...updateItemDto }, { transaction });

      const quantityAfter = item.quantity;

      if (quantityAfter <= quantityBefore) {
        return;
      }

      const updatedItem = await this.itemModel.findByPk(id, {
        include: [Supplier],
        transaction,
      });

      if (!updatedItem) {
        throw new NotFoundException(`Consommable avec l'ID #${id} introuvable.`);
      }

      await this.stockMovementModel.create(
        {
          movementType: 'ajout',
          itemId: updatedItem.id,
          itemName: updatedItem.name,
          itemInternalRef: updatedItem.internalRef ?? null,
          supplierId: updatedItem.supplierId ?? null,
          supplierName: updatedItem.supplier?.name ?? null,
          supplierRef: updatedItem.supplierRef ?? null,
          quantity: quantityAfter - quantityBefore,
          quantityBefore,
          quantityAfter,
          note: 'Ajout de stock enregistré depuis la fiche article.',
        },
        { transaction },
      );
    });

    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const item = await this.findOne(id);
    await item.destroy();
  }

  // --- LOGIQUE MÉTIER LABO STOCK ALERT ---
  async decrement(id: number, amount: number): Promise<Item> {
    await this.sequelize.transaction(async (transaction) => {
      const item = await this.itemModel.findByPk(id, {
        include: [Supplier],
        transaction,
      });

      if (!item) {
        throw new NotFoundException(`Consommable avec l'ID #${id} introuvable.`);
      }

      const quantityBefore = item.quantity;
      const newQuantity = quantityBefore - amount;

      if (isNaN(newQuantity)) {
        throw new BadRequestException(
          'Erreur de calcul du stock : valeur non numérique.',
        );
      }

      if (newQuantity < 0) {
        throw new BadRequestException(
          `Stock insuffisant (actuel: ${quantityBefore})`,
        );
      }

      await item.update({ quantity: newQuantity }, { transaction });

      await this.stockMovementModel.create(
        {
          movementType: 'usage',
          itemId: item.id,
          itemName: item.name,
          itemInternalRef: item.internalRef ?? null,
          supplierId: item.supplierId ?? null,
          supplierName: item.supplier?.name ?? null,
          supplierRef: item.supplierRef ?? null,
          quantity: amount,
          quantityBefore,
          quantityAfter: newQuantity,
          note: 'Utilisation enregistrée depuis le tableau de stock.',
        },
        { transaction },
      );
    });

    return this.findOne(id);
  }
}
