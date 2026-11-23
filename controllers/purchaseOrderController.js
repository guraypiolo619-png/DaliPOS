import { Op, UniqueConstraintError } from "sequelize";
import {
  Product,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseReceipt,
  PurchaseReceiptItem,
  sequelize,
  StockHistory,
  Supplier,
} from "../models/index.js";

const asArray = (value) => value === undefined ? [] : Array.isArray(value) ? value : [value];
const validId = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0;
const parseMoneyCents = (value) => {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const cents = Math.round(Number(value) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
};
const optionalText = (value) => typeof value === "string" ? value.trim() : "";

const supplierValues = (body) => {
  const name = optionalText(body.name);
  const contactName = optionalText(body.contactName);
  const phone = optionalText(body.phone);
  const email = optionalText(body.email);
  const address = optionalText(body.address);
  if (!name || name.length > 150 || contactName.length > 150 || phone.length > 32 ||
      email.length > 255 || address.length > 255 ||
      (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return null;
  }
  return {
    name,
    contactName: contactName || null,
    phone: phone || null,
    email: email || null,
    address: address || null,
  };
};

const redirectWithError = (req, res, message) => {
  req.flash("error_msg", message);
  return res.redirect("/admin/purchase-orders");
};

export const purchaseOrdersPage = async (req, res) => {
  const [suppliers, products, records] = await Promise.all([
    Supplier.findAll({ order: [["name", "ASC"]] }),
    Product.findAll({ where: { isActive: true }, order: [["name", "ASC"]] }),
    PurchaseOrder.findAll({
      limit: 100,
      order: [["createdAt", "DESC"]],
      include: [
        { association: "supplier", attributes: ["name"] },
        { association: "creator", attributes: ["name"] },
        { association: "items" },
        {
          association: "receipts",
          include: [
            { association: "receiver", attributes: ["name"] },
            { association: "items" },
          ],
        },
      ],
    }),
  ]);
  const orders = records.map((record) => {
    const order = record.get({ plain: true });
    order.createdAtLabel = new Date(order.createdAt).toLocaleString("en-PH");
    order.canReceive = order.status === "ordered" || order.status === "partially_received";
    order.canCancel = order.canReceive;
    order.items = order.items.map((item) => ({
      ...item,
      remaining: item.quantityOrdered - item.quantityReceived,
    }));
    order.receipts = order.receipts.map((receipt) => ({
      ...receipt,
      createdAtLabel: new Date(receipt.createdAt).toLocaleString("en-PH"),
    }));
    return order;
  });
  res.render("purchase-orders", {
    title: "Purchase Orders",
    suppliers: suppliers.map((supplier) => supplier.get({ plain: true })),
    activeSuppliers: suppliers.filter((supplier) => supplier.isActive).map((supplier) => supplier.get({ plain: true })),
    products: products.map((product) => product.get({ plain: true })),
    orders,
  });
};

export const createSupplier = async (req, res) => {
  const values = supplierValues(req.body);
  if (!values) return redirectWithError(req, res, "Check the supplier name and contact details.");

  try {
    await Supplier.create(values);
  } catch (error) {
    if (!(error instanceof UniqueConstraintError)) throw error;
    return redirectWithError(req, res, "A supplier with that name already exists.");
  }
  req.flash("success_msg", "Supplier added.");
  return res.redirect("/admin/purchase-orders");
};

export const updateSupplier = async (req, res) => {
  const id = Number(req.params.id);
  const values = supplierValues(req.body);
  if (!validId(id) || !values) return redirectWithError(req, res, "Check the supplier details.");

  const supplier = await Supplier.findByPk(id);
  if (!supplier) return redirectWithError(req, res, "Supplier not found.");
  try {
    await supplier.update(values);
  } catch (error) {
    if (!(error instanceof UniqueConstraintError)) throw error;
    return redirectWithError(req, res, "A supplier with that name already exists.");
  }
  req.flash("success_msg", "Supplier updated.");
  return res.redirect("/admin/purchase-orders");
};

export const toggleSupplier = async (req, res) => {
  const id = Number(req.params.id);
  if (!validId(id)) return redirectWithError(req, res, "Invalid supplier.");
  const supplier = await Supplier.findByPk(id);
  if (!supplier) return redirectWithError(req, res, "Supplier not found.");
  supplier.isActive = !supplier.isActive;
  await supplier.save();
  req.flash("success_msg", supplier.isActive ? "Supplier activated." : "Supplier deactivated.");
  return res.redirect("/admin/purchase-orders");
};

export const createPurchaseOrder = async (req, res) => {
  const supplierId = Number(req.body.supplierId);
  const productIds = asArray(req.body.productId);
  const quantities = asArray(req.body.quantity);
  const unitCosts = asArray(req.body.unitCost);
  const note = optionalText(req.body.note);
  if (!validId(supplierId) || !productIds.length || productIds.length > 100 ||
      productIds.length !== quantities.length || productIds.length !== unitCosts.length ||
      note.length > 255) {
    return redirectWithError(req, res, "Enter a supplier and between 1 and 100 valid purchase order items.");
  }

  const items = [];
  const uniqueProductIds = new Set();
  let totalCostCents = 0;
  for (let index = 0; index < productIds.length; index += 1) {
    const productId = Number(productIds[index]);
    const quantity = Number(quantities[index]);
    const unitCostCents = parseMoneyCents(unitCosts[index]);
    if (!validId(productId) || uniqueProductIds.has(productId) ||
        !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000 ||
        unitCostCents === null) {
      return redirectWithError(req, res, "Check each item, quantity, and unit cost. Products may appear only once per order.");
    }
    uniqueProductIds.add(productId);
    const lineCost = quantity * unitCostCents;
    totalCostCents += lineCost;
    if (!Number.isSafeInteger(lineCost) || totalCostCents > 999999999999) {
      return redirectWithError(req, res, "The purchase order total is too large.");
    }
    items.push({ productId, quantityOrdered: quantity, unitCost: (unitCostCents / 100).toFixed(2) });
  }

  const [supplier, products] = await Promise.all([
    Supplier.findOne({ where: { id: supplierId, isActive: true }, attributes: ["id"] }),
    Product.findAll({ where: { id: { [Op.in]: [...uniqueProductIds] }, isActive: true } }),
  ]);
  if (!supplier) return redirectWithError(req, res, "Select an active supplier.");
  if (products.length !== uniqueProductIds.size) {
    return redirectWithError(req, res, "One or more selected products are inactive or no longer exist.");
  }

  const productById = new Map(products.map((product) => [product.id, product]));
  for (const item of items) item.productName = productById.get(item.productId).name;
  const order = await sequelize.transaction(async (transaction) => {
    const createdOrder = await PurchaseOrder.create({
      supplierId,
      createdBy: req.user.id,
      status: "ordered",
      totalCost: (totalCostCents / 100).toFixed(2),
      note: note || null,
    }, { transaction });
    await PurchaseOrderItem.bulkCreate(items.map((item) => ({
      ...item,
      purchaseOrderId: createdOrder.id,
    })), { transaction });
    return createdOrder;
  });

  req.flash("success_msg", `Purchase order #${order.id} created.`);
  return res.redirect("/admin/purchase-orders");
};

export const receivePurchaseOrder = async (req, res) => {
  const orderId = Number(req.params.id);
  const itemIds = asArray(req.body.itemId);
  const quantities = asArray(req.body.quantityReceived);
  const unitCosts = asArray(req.body.unitCost);
  const note = optionalText(req.body.note);
  if (!validId(orderId) || !itemIds.length || itemIds.length > 100 ||
      itemIds.length !== quantities.length || itemIds.length !== unitCosts.length || note.length > 255) {
    return redirectWithError(req, res, "Check the received quantities and unit costs.");
  }

  const entries = [];
  const uniqueItemIds = new Set();
  for (let index = 0; index < itemIds.length; index += 1) {
    const itemId = Number(itemIds[index]);
    const quantity = Number(quantities[index]);
    if (!validId(itemId) || uniqueItemIds.has(itemId) ||
        !Number.isSafeInteger(quantity) || quantity < 0 || quantity > 1000000) {
      return redirectWithError(req, res, "Check each received quantity.");
    }
    uniqueItemIds.add(itemId);
    if (quantity === 0) continue;
    const unitCostCents = parseMoneyCents(unitCosts[index]);
    if (unitCostCents === null) return redirectWithError(req, res, "Enter a valid unit cost for each received item.");
    entries.push({ itemId, quantity, unitCostCents });
  }
  if (!entries.length) return redirectWithError(req, res, "Enter at least one quantity to receive.");

  try {
    await sequelize.transaction(async (transaction) => {
      const order = await PurchaseOrder.findByPk(orderId, {
        include: [{ association: "items" }],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!order || !["ordered", "partially_received"].includes(order.status)) {
        const error = new Error("This purchase order cannot receive more stock.");
        error.status = 409;
        throw error;
      }

      const orderItems = new Map(order.items.map((item) => [Number(item.id), item]));
      if ([...uniqueItemIds].some((itemId) => !orderItems.has(itemId))) {
        const error = new Error("A received item does not belong to this purchase order.");
        error.status = 409;
        throw error;
      }
      for (const entry of entries) {
        const item = orderItems.get(entry.itemId);
        if (!item || !item.productId || entry.quantity > item.quantityOrdered - item.quantityReceived) {
          const error = new Error("A received quantity exceeds the remaining amount on this order.");
          error.status = 409;
          throw error;
        }
      }

      const productIds = [...new Set(entries.map((entry) => orderItems.get(entry.itemId).productId))].sort((a, b) => a - b);
      const products = await Product.findAll({
        where: { id: { [Op.in]: productIds } },
        order: [["id", "ASC"]],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (products.length !== productIds.length) {
        const error = new Error("A product on this purchase order no longer exists.");
        error.status = 409;
        throw error;
      }
      const productById = new Map(products.map((product) => [product.id, product]));
      const receipt = await PurchaseReceipt.create({
        purchaseOrderId: order.id,
        receivedBy: req.user.id,
        note: note || null,
      }, { transaction });
      const receiptLines = [];
      const stockMovements = [];

      for (const entry of entries) {
        const item = orderItems.get(entry.itemId);
        const product = productById.get(item.productId);
        if (product.stock + entry.quantity > 4294967295) {
          const error = new Error(`Receiving ${item.productName} would exceed the maximum stock value.`);
          error.status = 400;
          throw error;
        }
        product.stock += entry.quantity;
        product.costPrice = (entry.unitCostCents / 100).toFixed(2);
        item.quantityReceived += entry.quantity;
        await product.save({ transaction });
        await item.save({ transaction });
        receiptLines.push({
          purchaseReceiptId: receipt.id,
          purchaseOrderItemId: item.id,
          productId: product.id,
          productName: item.productName,
          quantity: entry.quantity,
          unitCost: product.costPrice,
        });
        stockMovements.push({
          productId: product.id,
          userId: req.user.id,
          movementType: "restock",
          quantityChange: entry.quantity,
          stockBalance: product.stock,
          note: `Purchase order #${order.id}, receipt #${receipt.id}`,
        });
      }
      await Promise.all([
        PurchaseReceiptItem.bulkCreate(receiptLines, { transaction }),
        StockHistory.bulkCreate(stockMovements, { transaction }),
      ]);

      const fullyReceived = order.items.every((item) => item.quantityReceived >= item.quantityOrdered);
      order.status = fullyReceived ? "received" : "partially_received";
      await order.save({ transaction });
    });
  } catch (error) {
    if (error.status) return redirectWithError(req, res, error.message);
    throw error;
  }

  req.flash("success_msg", `Purchase order #${orderId} receipt recorded and stock updated.`);
  return res.redirect("/admin/purchase-orders");
};

export const cancelPurchaseOrder = async (req, res) => {
  const orderId = Number(req.params.id);
  if (!validId(orderId)) return redirectWithError(req, res, "Invalid purchase order.");
  const errorMessage = await sequelize.transaction(async (transaction) => {
    const order = await PurchaseOrder.findByPk(orderId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!order) return "Purchase order not found.";
    if (!["ordered", "partially_received"].includes(order.status)) {
      return "This purchase order can no longer be cancelled.";
    }
    order.status = "cancelled";
    await order.save({ transaction });
    return "";
  });
  if (errorMessage) return redirectWithError(req, res, errorMessage);
  req.flash("success_msg", `Purchase order #${orderId} cancelled. Previously received stock remains in inventory.`);
  return res.redirect("/admin/purchase-orders");
};
