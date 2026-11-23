import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const Category = sequelize.define("Category", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
}, {
  tableName: "categories",
  timestamps: true,
  underscored: true,
});
