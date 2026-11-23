import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const Product = sequelize.define("Product", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(150), allowNull: false },
  imageUrl: { type: DataTypes.STRING(255), allowNull: true, field: "image_url" },
  barcode: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  costPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: "0.00", field: "cost_price" },
  stock: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "is_active" },
  categoryId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: "category_id" },
}, {
  tableName: "products",
  timestamps: true,
  underscored: true,
});
