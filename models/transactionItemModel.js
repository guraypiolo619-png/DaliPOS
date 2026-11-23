import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const TransactionItem = sequelize.define("TransactionItem", {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  transactionId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: "transaction_id" },
  productId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: "product_id" },
  productName: { type: DataTypes.STRING(150), allowNull: false, field: "product_name" },
  unitPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false, field: "unit_price" },
  unitCost: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: "0.00", field: "unit_cost" },
  quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
}, {
  tableName: "transaction_items",
  timestamps: false,
  underscored: true,
});
