import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const PurchaseOrderItem = sequelize.define("PurchaseOrderItem", {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  purchaseOrderId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: "purchase_order_id" },
  productId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: "product_id" },
  productName: { type: DataTypes.STRING(150), allowNull: false, field: "product_name" },
  quantityOrdered: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "quantity_ordered" },
  quantityReceived: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: "quantity_received" },
  unitCost: { type: DataTypes.DECIMAL(10, 2), allowNull: false, field: "unit_cost" },
}, {
  tableName: "purchase_order_items",
  timestamps: true,
  underscored: true,
});
