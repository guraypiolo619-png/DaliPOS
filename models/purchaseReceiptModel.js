import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const PurchaseReceipt = sequelize.define("PurchaseReceipt", {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  purchaseOrderId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: "purchase_order_id" },
  receivedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "received_by" },
  note: { type: DataTypes.STRING(255), allowNull: true },
}, {
  tableName: "purchase_receipts",
  timestamps: true,
  updatedAt: false,
  underscored: true,
});
