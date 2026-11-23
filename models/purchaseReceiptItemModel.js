import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const PurchaseReceiptItem = sequelize.define("PurchaseReceiptItem", {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  purchaseReceiptId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: "purchase_receipt_id" },
  purchaseOrderItemId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: "purchase_order_item_id" },
  productId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: "product_id" },
  productName: { type: DataTypes.STRING(150), allowNull: false, field: "product_name" },
  quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  unitCost: { type: DataTypes.DECIMAL(10, 2), allowNull: false, field: "unit_cost" },
}, {
  tableName: "purchase_receipt_items",
  timestamps: true,
  underscored: true,
});
