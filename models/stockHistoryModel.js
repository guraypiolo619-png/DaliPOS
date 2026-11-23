import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const StockHistory = sequelize.define("StockHistory", {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  productId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: "product_id" },
  userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: "user_id" },
  transactionId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: "transaction_id" },
  movementType: { type: DataTypes.ENUM("restock", "sale", "adjustment"), allowNull: false, field: "movement_type" },
  quantityChange: { type: DataTypes.INTEGER, allowNull: false, field: "quantity_change" },
  stockBalance: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "stock_balance" },
  note: { type: DataTypes.STRING(255), allowNull: true },
}, {
  tableName: "stock_history",
  timestamps: true,
  updatedAt: false,
  underscored: true,
});
