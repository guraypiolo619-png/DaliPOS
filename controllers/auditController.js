import { Op } from "sequelize";
import { ActivityLog, Product, StockHistory } from "../models/index.js";

const validDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
};

const durationLabel = (seconds) => {
  if (seconds === null || seconds === undefined) return "In progress";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return [hours && `${hours}h`, minutes && `${minutes}m`, `${remainingSeconds}s`].filter(Boolean).join(" ");
};

export const activityLogs = async (req, res) => {
  const role = ["admin", "staff"].includes(req.query.role) ? req.query.role : "";
  const date = typeof req.query.date === "string" && validDate(req.query.date) ? req.query.date : "";
  const where = {};
  if (role) where.role = role;
  if (date) {
    const from = new Date(`${date}T00:00:00`);
    const until = new Date(from);
    until.setDate(until.getDate() + 1);
    where.occurredAt = { [Op.gte]: from, [Op.lt]: until };
  }

  const records = await ActivityLog.findAll({
    where,
    order: [["occurredAt", "DESC"]],
    limit: 200,
  });
  const logs = records.map((record) => ({
    ...record.get({ plain: true }),
    actionLabel: record.action === "login" ? "Login" : "Logout",
    roleLabel: record.role === "admin" ? "Admin" : "Staff",
    statusLabel: record.status === "active" ? "Active" : "Offline",
    durationLabel: durationLabel(record.sessionDurationSeconds),
  }));
  res.render("activity-logs", {
    title: "Activity Logs",
    logs,
    filters: { role, date },
  });
};

export const stockHistory = async (req, res) => {
  const movement = ["restock", "sale", "adjustment"].includes(req.query.movement)
    ? req.query.movement
    : "";
  const where = movement ? { movementType: movement } : {};
  const [records, recentSales, lowStockProducts] = await Promise.all([
    StockHistory.findAll({
      where,
      include: [
        { association: "product", attributes: ["name"] },
        { association: "actor", attributes: ["name"] },
      ],
      order: [["createdAt", "DESC"]],
      limit: 250,
    }),
    StockHistory.findAll({
      where: {
        movementType: "sale",
        createdAt: { [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      attributes: ["productId", "quantityChange"],
    }),
    Product.findAll({
      where: { isActive: true, stock: { [Op.lte]: 10 } },
      order: [["stock", "ASC"]],
    }),
  ]);

  const dailySales = new Map();
  for (const sale of recentSales) {
    dailySales.set(sale.productId, (dailySales.get(sale.productId) || 0) + Math.abs(sale.quantityChange));
  }
  const depletionEstimates = new Map();
  for (const product of lowStockProducts) {
    const average = (dailySales.get(product.id) || 0) / 30;
    if (product.stock === 0) {
      depletionEstimates.set(product.id, "Out of stock");
    } else if (average > 0) {
      const depletionDate = new Date();
      depletionDate.setDate(depletionDate.getDate() + Math.ceil(product.stock / average));
      depletionEstimates.set(product.id, depletionDate.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }));
    } else {
      depletionEstimates.set(product.id, "No recent sales");
    }
  }

  const history = records.map((record) => ({
    ...record.get({ plain: true }),
    movementLabel: record.movementType === "sale"
      ? "Sale"
      : record.movementType === "restock" ? "Restock" : "Adjustment",
    productName: record.product ? record.product.name : "Product removed",
    actorName: record.actor ? record.actor.name : "System",
    changeLabel: record.quantityChange > 0 ? `+${record.quantityChange}` : String(record.quantityChange),
    isIncrease: record.quantityChange > 0,
    depletionEstimate: record.stockBalance === 0
      ? "Out of stock"
      : (dailySales.get(record.productId) || 0) > 0
        ? (() => {
          const date = new Date(record.createdAt);
          date.setDate(date.getDate() + Math.ceil(record.stockBalance / ((dailySales.get(record.productId) || 0) / 30)));
          return date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
        })()
        : "No recent sales",
  }));
  const lowStock = lowStockProducts.map((product) => ({
    ...product.get({ plain: true }),
    depletionEstimate: depletionEstimates.get(product.id),
  }));
  res.render("stock-history", {
    title: "Stock History & Alerts",
    history,
    lowStock,
    filters: { movement },
  });
};
