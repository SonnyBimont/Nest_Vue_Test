import { Column, DataType, Model, Table } from 'sequelize-typescript';

export const STOCK_MOVEMENT_TYPES = ['usage'] as const;

export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

@Table
export class StockMovement extends Model {
  @Column({ type: DataType.ENUM(...STOCK_MOVEMENT_TYPES) })
  declare movementType: StockMovementType;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare itemId: number | null;

  @Column
  declare itemName: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare itemInternalRef: string | null;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare supplierId: number | null;

  @Column({ type: DataType.STRING, allowNull: true })
  declare supplierName: string | null;

  @Column({ type: DataType.STRING, allowNull: true })
  declare supplierRef: string | null;

  @Column({ type: DataType.INTEGER })
  declare quantity: number;

  @Column({ type: DataType.INTEGER })
  declare quantityBefore: number;

  @Column({ type: DataType.INTEGER })
  declare quantityAfter: number;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare note: string | null;

  @Column({ type: DataType.DATE })
  declare createdAt: Date;

  @Column({ type: DataType.DATE })
  declare updatedAt: Date;
}