import { Op } from "sequelize";
import { Product, StockHistory, Transaction, TransactionItem, sequelize } from "../models/index.js";

const TAX_RATE_PERCENT = 12;

const paymentMethodLabels = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  card: "Card",
};

export const posPage = async (req, res) => {
  const products = await Product.findAll({
    where: { isActive: true, stock: { [Op.gt]: 0 } },
    include: [{ association: "category", attributes: ["id", "name"] }],
    order: [["name", "ASC"]],
  });
  const categories = [...new Set(products.map((product) => product.category && product.category.name).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
  res.render("pos", { title: "Point of Sale", products, categories });
};

export const checkout = async (req, res) => {
  const cart = req.body && req.body.items;
  if (!Array.isArray(cart) || cart.length === 0 || cart.length > 100) {
    return res.status(400).json({ error: "The cart is empty." });
  }

  const customerName = typeof req.body.customerName === "string"
    ? req.body.customerName.trim()
    : "";
  const paymentMethod = req.body.paymentMethod;
  const amountTenderedInput = req.body.amountTendered;
  if (customerName.length > 120) {
    return res.status(400).json({ error: "Customer name must be 120 characters or fewer." });
  }
  if (!["cash", "gcash", "maya", "card"].includes(paymentMethod)) {
    return res.status(400).json({ error: "Select a valid payment method." });
  }

  const quantities = new Map();
  for (const item of cart) {
    const productId = Number(item && item.productId);
    const quantity = Number(item && item.quantity);
    if (!Number.isSafeInteger(productId) || productId < 1 ||
        !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 4294967295) {
      return res.status(400).json({ error: "Invalid product or quantity in the cart." });
    }
    const combinedQuantity = (quantities.get(productId) || 0) + quantity;
    if (combinedQuantity > 4294967295) {
      return res.status(400).json({ error: "The quantity in the cart is too large." });
    }
    quantities.set(productId, combinedQuantity);
  }

  try {
    const receipt = await sequelize.transaction(async (dbTransaction) => {
      const products = await Product.findAll({
        where: { id: { [Op.in]: [...quantities.keys()] }, isActive: true },
        transaction: dbTransaction,
        lock: dbTransaction.LOCK.UPDATE,
      });

      if (products.length !== quantities.size) {
        const error = new Error("A product in the cart no longer exists or is inactive.");
        error.status = 409;
        throw error;
      }

      let subtotalCents = 0;
      const lines = products.map((product) => {
        const quantity = quantities.get(product.id);
        if (product.stock < quantity) {
          const error = new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}.`);
          error.status = 409;
          throw error;
        }

        const unitCents = Math.round(Number(product.price) * 100);
        const lineSubtotalCents = unitCents * quantity;
        subtotalCents += lineSubtotalCents;
        if (!Number.isSafeInteger(lineSubtotalCents) || !Number.isSafeInteger(subtotalCents) || subtotalCents > 999999999999) {
          const error = new Error("The transaction total exceeds the allowed amount.");
          error.status = 400;
          throw error;
        }
        product.stock -= quantity;
        return {
          productId: product.id,
          productName: product.name,
          unitPrice: (unitCents / 100).toFixed(2),
          unitCost: Number(product.costPrice).toFixed(2),
          quantity,
          subtotal: (lineSubtotalCents / 100).toFixed(2),
        };
      });

      const taxCents = Math.round(subtotalCents * TAX_RATE_PERCENT / 100);
      const totalCents = subtotalCents + taxCents;
      if (!Number.isSafeInteger(taxCents) || !Number.isSafeInteger(totalCents) || totalCents > 999999999999) {
        const error = new Error("The transaction total exceeds the allowed amount.");
        error.status = 400;
        throw error;
      }

      const amountTenderedCents = paymentMethod === "cash"
        ? (typeof amountTenderedInput === "string" && /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(amountTenderedInput)
          ? Math.round(Number(amountTenderedInput) * 100)
          : NaN)
        : totalCents;
      if (!Number.isSafeInteger(amountTenderedCents) || amountTenderedCents < totalCents) {
        const error = new Error("Cash received must be a valid amount equal to or greater than the total.");
        error.status = 400;
        throw error;
      }

      const sale = await Transaction.create({
        userId: req.user.id,
        customerName: customerName || "Walk-in customer",
        subtotal: (subtotalCents / 100).toFixed(2),
        taxAmount: (taxCents / 100).toFixed(2),
        total: (totalCents / 100).toFixed(2),
        paymentMethod,
        amountTendered: (amountTenderedCents / 100).toFixed(2),
        changeGiven: ((amountTenderedCents - totalCents) / 100).toFixed(2),
        status: "completed",
      }, { transaction: dbTransaction });
      await Promise.all(products.map((product) => product.save({ transaction: dbTransaction })));
      await TransactionItem.bulkCreate(
        lines.map((line) => ({ ...line, transactionId: sale.id })),
        { transaction: dbTransaction }
      );
      await StockHistory.bulkCreate(products.map((product) => ({
        productId: product.id,
        userId: req.user.id,
        transactionId: sale.id,
        movementType: "sale",
        quantityChange: -quantities.get(product.id),
        stockBalance: product.stock,
        note: `Sale #${sale.id}`,
      })), { transaction: dbTransaction });
      return {
        id: sale.id,
        customerName: sale.customerName,
        subtotal: sale.subtotal,
        taxAmount: sale.taxAmount,
        total: sale.total,
        paymentMethod: sale.paymentMethod,
        amountTendered: sale.amountTendered,
        changeGiven: sale.changeGiven,
        items: lines,
      };
    });

    res.status(201).json({
      message: "Sale completed successfully.",
      receipt,
      receiptUrl: `/sales/${receipt.id}/receipt`,
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    throw error;
  }
};

export const salesReceipt = async (req, res) => {
  const sale = await Transaction.findByPk(req.params.id, {
    include: [
      { association: "cashier", attributes: ["name"] },
      { association: "items" },
    ],
  });
  if (!sale) {
    return res.status(404).render("error", {
      title: "Receipt not found",
      message: "There is no sale receipt at this address.",
    });
  }
  if (req.user.role !== "admin" && String(sale.userId) !== String(req.user.id)) {
    return res.status(403).render("error", {
      title: "Access denied",
      message: "You do not have permission to access this receipt.",
    });
  }
  sale.setDataValue("paymentMethodLabel", paymentMethodLabels[sale.paymentMethod]);
  res.render("receipt", { title: `Receipt #${sale.id}`, sale });
};

export const salesList = async (req, res) => {
  const sales = await Transaction.findAll({
    limit: 100,
    order: [["createdAt", "DESC"]],
    include: [
      { association: "cashier", attributes: ["name"] },
      { association: "items" },
    ],
  });
  for (const sale of sales) {
    sale.setDataValue("paymentMethodLabel", paymentMethodLabels[sale.paymentMethod]);
  }
  res.render("sales", { title: "Sales", sales });
};
