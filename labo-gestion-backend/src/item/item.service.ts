import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Item } from './entities/item.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';

@Injectable()
export class ItemService {
  private readonly logger = new Logger(ItemService.name);

  // Injection du modèle de la base de données
  constructor(
    @InjectModel(Item)
    private itemModel: typeof Item,
    @InjectModel(Supplier)
    private supplierModel: typeof Supplier,
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

  async update(id: number, updateItemDto: UpdateItemDto): Promise<Item> {
    const item = await this.findOne(id);
    return item.update({ ...updateItemDto });
  }

  async remove(id: number): Promise<void> {
    const item = await this.findOne(id);
    await item.destroy();
  }

  // --- LOGIQUE MÉTIER LABO STOCK ALERT ---
  async decrement(id: number, amount: number): Promise<Item> {
    const item = await this.findOne(id);
    if (item.quantity < amount) {
      throw new Error('Stock insuffisant');
    }

    item.quantity -= amount;
    await item.save();
    return item;
  }

  async decrementStock(id: number, amount: number): Promise<Item> {
    const item = await this.findOne(id);
    item.quantity -= amount;
    await item.save();

    if (item.quantity <= item.lowStockThreshold) {
      this.logger.warn(
        `ALERTE : Stock critique pour [${item.name}]. Quantité restante : ${item.quantity}.`,
      );
    }
    return item;
  }
}
