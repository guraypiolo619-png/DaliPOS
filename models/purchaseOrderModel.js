import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const PurchaseOrder = sequelize.define("PurchaseOrder", {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  supplierId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "supplier_id" },
  createdBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "created_by" },
  status: {
    type: DataTypes.ENUM("ordered", "partially_received", "received", "cancelled"),
    allowNull: false,
    defaultValue: "ordered",
  },
  totalCost: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: "total_cost" },
  note: { type: DataTypes.STRING(255), allowNull: true },
}, {
  tableName: "purchase_orders",
  timestamps: true,
  underscored: true,
});
