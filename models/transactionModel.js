import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const Transaction = sequelize.define("Transaction", {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "user_id" },
  customerName: { type: DataTypes.STRING(120), allowNull: false, defaultValue: "Walk-in customer", field: "customer_name" },
  subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  taxAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: "0.00", field: "tax_amount" },
  total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  paymentMethod: { type: DataTypes.ENUM("cash", "gcash", "maya", "card"), allowNull: false, field: "payment_method" },
  amountTendered: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: "amount_tendered" },
  changeGiven: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: "0.00", field: "change_given" },
  status: { type: DataTypes.ENUM("completed", "voided"), allowNull: false, defaultValue: "completed" },
}, {
  tableName: "transactions",
  timestamps: true,
  updatedAt: false,
  underscored: true,
});
