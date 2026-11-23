import { Op } from "sequelize";
import { Category, Product, Transaction } from "../models/index.js";
import { posPage } from "./posController.js";

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const startOfWeek = (date) => {
  const start = startOfDay(date);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
};
const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const currency = (amount) => Number(amount || 0).toFixed(2);
const toCents = (amount) => Math.round(Number(amount || 0) * 100);

export const homePage = (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  res.redirect("/dashboard");
};

export const dashboard = async (req, res) => {
  if (req.user.role === "staff") return posPage(req, res);

  const now = new Date();
  const today = startOfDay(now);
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);
  const trendStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const queryStart = trendStart;

  const [productCount, categoryCount, salesCount, lowStockProducts, monthSales, recentSales] =
    await Promise.all([
      Product.count({ where: { isActive: true } }),
      Category.count(),
      Transaction.count({ where: { status: "completed" } }),
      Product.findAll({
        where: { isActive: true, stock: { [Op.lte]: 10 } },
        order: [["stock", "ASC"], ["name", "ASC"]],
        limit: 8,
      }),
      Transaction.findAll({
        where: { status: "completed", createdAt: { [Op.gte]: queryStart } },
        include: [{ association: "items", attributes: ["quantity", "subtotal", "unitCost"] }],
        order: [["createdAt", "ASC"]],
      }),
      Transaction.findAll({
        where: { status: "completed" },
        limit: 8,
        order: [["createdAt", "DESC"]],
        include: [
          { association: "cashier", attributes: ["name"] },
          { association: "items", attributes: ["productName", "quantity", "subtotal"] },
        ],
      }),
    ]);

  const aggregate = (sales) => sales.reduce((totals, sale) => {
    totals.revenueCents += toCents(sale.subtotal);
    for (const item of sale.items) {
      totals.items += Number(item.quantity);
      totals.profitCents += toCents(item.subtotal) - toCents(item.unitCost) * Number(item.quantity);
    }
    return totals;
  }, { revenueCents: 0, items: 0, profitCents: 0 });

  const inPeriod = (sale, from) => new Date(sale.createdAt) >= from;
  const todayTotals = aggregate(monthSales.filter((sale) => inPeriod(sale, today)));
  const weekTotals = aggregate(monthSales.filter((sale) => inPeriod(sale, weekStart)));
  const monthTotals = aggregate(monthSales.filter((sale) => inPeriod(sale, monthStart)));
  const trend = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(trendStart.getFullYear(), trendStart.getMonth() + index, 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    const totalCents = monthSales
      .filter((sale) => new Date(sale.createdAt) >= date && new Date(sale.createdAt) < end)
      .reduce((sum, sale) => sum + toCents(sale.subtotal), 0);
    return {
      label: date.toLocaleDateString("en-PH", { month: "short" }),
      dateLabel: date.toLocaleDateString("en-PH", { month: "long", year: "numeric" }),
      total: currency(totalCents / 100),
      x: 50 + index * 100,
      y: 0,
      numericTotal: totalCents,
    };
  });
  const maxTrend = Math.max(...trend.map((item) => item.numericTotal), 1);
  for (const item of trend) item.y = Math.round(215 - item.numericTotal / maxTrend * 160);
  const trendPath = trend.map((item) => `${item.x},${item.y}`).join(" ");
  const recentRows = recentSales.map((sale) => ({
    ...sale.get({ plain: true }),
    createdAtMs: new Date(sale.createdAt).getTime(),
  }));

  res.render("home", {
    title: "Dashboard",
    productCount,
    categoryCount,
    lowStockCount: res.locals.lowStockCount || 0,
    lowStockProducts,
    salesCount,
    todayRevenue: currency(todayTotals.revenueCents / 100),
    todayItems: todayTotals.items,
    weekRevenue: currency(weekTotals.revenueCents / 100),
    monthRevenue: currency(monthTotals.revenueCents / 100),
    monthItems: monthTotals.items,
    netProfit: currency(monthTotals.profitCents / 100),
    trend,
    trendPath,
    recentSales: recentRows,
    formatCurrency: currency,
  });
};
