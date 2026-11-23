import { Op } from "sequelize";
import { Category, Product, sequelize, Transaction, TransactionItem } from "../models/index.js";

const MAX_PAGE_SIZE = 100;

const pagination = (query) => {
  const pageValue = query.page === undefined ? "1" : query.page;
  const limitValue = query.limit === undefined ? "50" : query.limit;
  if (typeof pageValue !== "string" || typeof limitValue !== "string") return null;

  const page = Number(pageValue);
  const limit = Number(limitValue);
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > MAX_PAGE_SIZE
  ) {
    return null;
  }

  return { page, limit, offset: (page - 1) * limit };
};

const paginationResponse = ({ page, limit }, total) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

const invalidQuery = (res, message) => res.status(400).json({
  error: { code: "INVALID_QUERY", message },
});

const productFields = [
  "id",
  "name",
  "barcode",
  "price",
  "costPrice",
  "stock",
  "isActive",
  "categoryId",
  "updatedAt",
];

export const integrationHealth = async (req, res) => {
  await sequelize.authenticate();
  res.json({
    service: "dali-pos",
    status: "ok",
    capabilities: ["products:read", "inventory:read", "sales:read"],
  });
};

const listProducts = async (req, res, includeInactive) => {
  const page = pagination(req.query);
  if (!page) {
    return invalidQuery(res, `page must be a positive integer and limit must be between 1 and ${MAX_PAGE_SIZE}.`);
  }

  const { count, rows } = await Product.findAndCountAll({
    attributes: productFields,
    include: [{ model: Category, attributes: ["id", "name"], required: false }],
    where: includeInactive ? undefined : { isActive: true },
    order: [["id", "ASC"]],
    limit: page.limit,
    offset: page.offset,
  });

  res.json({
    data: rows.map((product) => ({
      id: product.id,
      name: product.name,
      barcode: product.barcode,
      price: product.price,
      costPrice: product.costPrice,
      stock: product.stock,
      isActive: product.isActive,
      category: product.category ? {
        id: product.category.id,
        name: product.category.name,
      } : null,
      updatedAt: product.updatedAt,
    })),
    pagination: paginationResponse(page, count),
  });
};

export const integrationProducts = (req, res) => listProducts(req, res, true);

export const integrationInventory = (req, res) => listProducts(req, res, false);

const parseDate = (value) => {
  if (value === undefined) return null;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export const integrationSales = async (req, res) => {
  const page = pagination(req.query);
  if (!page) {
    return invalidQuery(res, `page must be a positive integer and limit must be between 1 and ${MAX_PAGE_SIZE}.`);
  }

  const from = parseDate(req.query.from);
  const to = parseDate(req.query.to);
  if (from === undefined || to === undefined || (from && to && from > to)) {
    return invalidQuery(res, "from and to must be valid ISO 8601 dates, and from must not be later than to.");
  }

  const createdAt = {};
  if (from) createdAt[Op.gte] = from;
  if (to) createdAt[Op.lte] = to;

  const { count, rows } = await Transaction.findAndCountAll({
    where: {
      status: "completed",
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
    },
    include: [{
      model: TransactionItem,
      as: "items",
      attributes: ["productId", "productName", "unitPrice", "unitCost", "quantity", "subtotal"],
    }],
    order: [["id", "ASC"]],
    limit: page.limit,
    offset: page.offset,
    distinct: true,
  });

  res.json({
    data: rows.map((sale) => ({
      id: sale.id,
      subtotal: sale.subtotal,
      taxAmount: sale.taxAmount,
      total: sale.total,
      paymentMethod: sale.paymentMethod,
      createdAt: sale.createdAt,
      items: sale.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        unitPrice: item.unitPrice,
        unitCost: item.unitCost,
        quantity: item.quantity,
        subtotal: item.subtotal,
      })),
    })),
    pagination: paginationResponse(page, count),
  });
};
