import { initializeDatabase, sequelize } from "./db.js";
import { User } from "./userModel.js";
import { Category } from "./categoryModel.js";
import { Product } from "./productModel.js";
import { Transaction } from "./transactionModel.js";
import { TransactionItem } from "./transactionItemModel.js";
import { StockHistory } from "./stockHistoryModel.js";
import { ActivityLog } from "./activityLogModel.js";
import { Supplier } from "./supplierModel.js";
import { PurchaseOrder } from "./purchaseOrderModel.js";
import { PurchaseOrderItem } from "./purchaseOrderItemModel.js";
import { PurchaseReceipt } from "./purchaseReceiptModel.js";
import { PurchaseReceiptItem } from "./purchaseReceiptItemModel.js";

User.hasMany(Transaction, { foreignKey: "userId", as: "transactions" });
Transaction.belongsTo(User, { foreignKey: "userId", as: "cashier" });
Category.hasMany(Product, { foreignKey: "categoryId", as: "products" });
Product.belongsTo(Category, { foreignKey: "categoryId", as: "category" });
Transaction.hasMany(TransactionItem, { foreignKey: "transactionId", as: "items" });
TransactionItem.belongsTo(Transaction, { foreignKey: "transactionId" });
Product.hasMany(TransactionItem, { foreignKey: "productId" });
TransactionItem.belongsTo(Product, { foreignKey: "productId" });
Product.hasMany(StockHistory, { foreignKey: "productId", as: "stockMovements" });
StockHistory.belongsTo(Product, { foreignKey: "productId", as: "product" });
User.hasMany(StockHistory, { foreignKey: "userId" });
StockHistory.belongsTo(User, { foreignKey: "userId", as: "actor" });
Transaction.hasMany(StockHistory, { foreignKey: "transactionId" });
StockHistory.belongsTo(Transaction, { foreignKey: "transactionId" });
User.hasMany(ActivityLog, { foreignKey: "userId" });
ActivityLog.belongsTo(User, { foreignKey: "userId", onDelete: "SET NULL" });
Supplier.hasMany(PurchaseOrder, { foreignKey: "supplierId", as: "purchaseOrders", onDelete: "RESTRICT", onUpdate: "CASCADE" });
PurchaseOrder.belongsTo(Supplier, { foreignKey: "supplierId", as: "supplier", onDelete: "RESTRICT", onUpdate: "CASCADE" });
User.hasMany(PurchaseOrder, { foreignKey: "createdBy", as: "createdPurchaseOrders", onDelete: "RESTRICT", onUpdate: "CASCADE" });
PurchaseOrder.belongsTo(User, { foreignKey: "createdBy", as: "creator", onDelete: "RESTRICT", onUpdate: "CASCADE" });
PurchaseOrder.hasMany(PurchaseOrderItem, { foreignKey: "purchaseOrderId", as: "items", onDelete: "CASCADE", onUpdate: "CASCADE" });
PurchaseOrderItem.belongsTo(PurchaseOrder, { foreignKey: "purchaseOrderId", as: "purchaseOrder", onDelete: "CASCADE", onUpdate: "CASCADE" });
Product.hasMany(PurchaseOrderItem, { foreignKey: "productId", as: "purchaseOrderItems", onDelete: "SET NULL", onUpdate: "CASCADE" });
PurchaseOrderItem.belongsTo(Product, { foreignKey: "productId", as: "product", onDelete: "SET NULL", onUpdate: "CASCADE" });
PurchaseOrder.hasMany(PurchaseReceipt, { foreignKey: "purchaseOrderId", as: "receipts", onDelete: "RESTRICT", onUpdate: "CASCADE" });
PurchaseReceipt.belongsTo(PurchaseOrder, { foreignKey: "purchaseOrderId", as: "purchaseOrder", onDelete: "RESTRICT", onUpdate: "CASCADE" });
User.hasMany(PurchaseReceipt, { foreignKey: "receivedBy", as: "purchaseReceipts", onDelete: "RESTRICT", onUpdate: "CASCADE" });
PurchaseReceipt.belongsTo(User, { foreignKey: "receivedBy", as: "receiver", onDelete: "RESTRICT", onUpdate: "CASCADE" });
PurchaseReceipt.hasMany(PurchaseReceiptItem, { foreignKey: "purchaseReceiptId", as: "items", onDelete: "CASCADE", onUpdate: "CASCADE" });
PurchaseReceiptItem.belongsTo(PurchaseReceipt, { foreignKey: "purchaseReceiptId", as: "receipt", onDelete: "CASCADE", onUpdate: "CASCADE" });
PurchaseOrderItem.hasMany(PurchaseReceiptItem, { foreignKey: "purchaseOrderItemId", as: "receipts", onDelete: "RESTRICT", onUpdate: "CASCADE" });
PurchaseReceiptItem.belongsTo(PurchaseOrderItem, { foreignKey: "purchaseOrderItemId", as: "orderItem", onDelete: "RESTRICT", onUpdate: "CASCADE" });
Product.hasMany(PurchaseReceiptItem, { foreignKey: "productId", as: "purchaseReceiptItems", onDelete: "SET NULL", onUpdate: "CASCADE" });
PurchaseReceiptItem.belongsTo(Product, { foreignKey: "productId", as: "product", onDelete: "SET NULL", onUpdate: "CASCADE" });

export {
  initializeDatabase,
  sequelize,
  User,
  Category,
  Product,
  Transaction,
  TransactionItem,
  StockHistory,
  ActivityLog,
  Supplier,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseReceipt,
  PurchaseReceiptItem,
};
