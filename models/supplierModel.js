import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const Supplier = sequelize.define("Supplier", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(150), allowNull: false, unique: true },
  contactName: { type: DataTypes.STRING(150), allowNull: true, field: "contact_name" },
  phone: { type: DataTypes.STRING(32), allowNull: true },
  email: { type: DataTypes.STRING(255), allowNull: true },
  address: { type: DataTypes.STRING(255), allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "is_active" },
}, {
  tableName: "suppliers",
  timestamps: true,
  underscored: true,
});
