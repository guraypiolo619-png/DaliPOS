import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Op, UniqueConstraintError } from "sequelize";
import { Category, Product, sequelize, StockHistory } from "../models/index.js";

const productImageDirectory = fileURLToPath(new URL("../public/uploads/products", import.meta.url));
const imageTypes = {
  "image/jpeg": { extension: ".jpg", matches: (buffer) => buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
  "image/png": { extension: ".png", matches: (buffer) => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/webp": { extension: ".webp", matches: (buffer) => buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP" },
};

const saveProductImage = async (file) => {
  if (!file) return null;

  const imageType = imageTypes[file.mimetype];
  if (!imageType || !imageType.matches(file.buffer)) {
    const error = new Error("The uploaded file is not a valid JPEG, PNG, or WebP image.");
    error.status = 400;
    throw error;
  }

  const filename = `${randomUUID()}${imageType.extension}`;
  await mkdir(productImageDirectory, { recursive: true });
  await writeFile(path.join(productImageDirectory, filename), file.buffer, { flag: "wx" });
  return `/uploads/products/${filename}`;
};

const removeProductImage = async (imageUrl) => {
  if (imageUrl && imageUrl.startsWith("/uploads/products/")) {
    try {
      await unlink(path.join(productImageDirectory, path.basename(imageUrl)));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
};

const productInput = (body) => {
  const name = String(body.name || "").trim();
  const barcode = String(body.barcode || "").trim();
  const price = Number(body.price);
  const costPrice = body.costPrice === undefined || body.costPrice === "" ? 0 : Number(body.costPrice);
  const stock = Number(body.stock);
  const categoryId = body.categoryId ? Number(body.categoryId) : null;

  if (!name || name.length > 150 || !barcode || barcode.length > 64 ||
      !Number.isFinite(price) || price < 0 || price > 99999999.99 ||
      !Number.isFinite(costPrice) || costPrice < 0 || costPrice > 99999999.99 ||
      !Number.isSafeInteger(stock) || stock < 0 ||
      (categoryId !== null && (!Number.isSafeInteger(categoryId) || categoryId < 1))) {
    return null;
  }

  return { name, barcode, price: price.toFixed(2), costPrice: costPrice.toFixed(2), stock, categoryId };
};

export const productList = async (req, res) => {
  const [products, categories] = await Promise.all([
    Product.findAll({ include: [{ model: Category, as: "category", attributes: ["name"] }], order: [["name", "ASC"]] }),
    Category.findAll({ order: [["name", "ASC"]] }),
  ]);
  const categoryRows = categories.map((category) => category.get({ plain: true }));
  const productRows = products.map((product) => ({
    ...product.get({ plain: true }),
    isLowStock: product.isActive && product.stock <= 10,
    isOutOfStock: product.isActive && product.stock === 0,
    categoryOptions: categoryRows.map((category) => ({
      ...category,
      selected: category.id === product.categoryId,
    })),
  }));
  res.render("products", { title: "Products", products: productRows, categories: categoryRows });
};

export const createProduct = async (req, res) => {
  const values = productInput(req.body);
  if (!values) {
    req.flash("error_msg", "Check the product name, barcode, price, stock, and category.");
    return res.redirect("/admin/products");
  }
  if (values.categoryId && !(await Category.findByPk(values.categoryId))) {
    req.flash("error_msg", "The selected category could not be found.");
    return res.redirect("/admin/products");
  }

  let imageUrl;
  try {
    imageUrl = await saveProductImage(req.file);
    await sequelize.transaction(async (transaction) => {
      const product = await Product.create(
        { ...values, ...(imageUrl ? { imageUrl } : {}) },
        { transaction }
      );
      if (values.stock > 0) {
        await StockHistory.create({
          productId: product.id,
          userId: req.user.id,
          movementType: "restock",
          quantityChange: values.stock,
          stockBalance: values.stock,
          note: "Initial stock",
        }, { transaction });
      }
    });
    req.flash("success_msg", "Product added.");
  } catch (error) {
    if (imageUrl) await removeProductImage(imageUrl);
    if (!(error instanceof UniqueConstraintError)) throw error;
    req.flash("error_msg", "A product with that barcode already exists.");
  }
  res.redirect("/admin/products");
};

export const updateProduct = async (req, res) => {
  const id = Number(req.params.id);
  const values = productInput(req.body);
  if (!Number.isSafeInteger(id) || id < 1 || !values) {
    req.flash("error_msg", "Check the product details.");
    return res.redirect("/admin/products");
  }
  if (values.categoryId && !(await Category.findByPk(values.categoryId))) {
    req.flash("error_msg", "The selected category could not be found.");
    return res.redirect("/admin/products");
  }

  const product = await Product.findOne({
    where: { id, isActive: true },
    attributes: ["id", "imageUrl"],
  });
  if (!product) {
    req.flash("error_msg", "Product not found.");
    return res.redirect("/admin/products");
  }

  let imageUrl;
  try {
    imageUrl = await saveProductImage(req.file);
    await sequelize.transaction(async (transaction) => {
      const currentProduct = await Product.findOne({
        where: { id, isActive: true },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!currentProduct) {
        const error = new Error("Product not found.");
        error.status = 404;
        throw error;
      }
      const previousStock = currentProduct.stock;
      currentProduct.set({ ...values, ...(imageUrl ? { imageUrl } : {}) });
      await currentProduct.save({ transaction });
      const quantityChange = values.stock - previousStock;
      if (quantityChange !== 0) {
        const isRestock = quantityChange > 0 && req.body.stockReason === "restock";
        await StockHistory.create({
          productId: currentProduct.id,
          userId: req.user.id,
          movementType: isRestock ? "restock" : "adjustment",
          quantityChange,
          stockBalance: values.stock,
          note: isRestock ? "Manual restock" : "Manual stock adjustment",
        }, { transaction });
      }
    });
  } catch (error) {
    if (imageUrl) await removeProductImage(imageUrl);
    if (error.status === 404) {
      req.flash("error_msg", "Product not found.");
      return res.redirect("/admin/products");
    }
    if (!(error instanceof UniqueConstraintError)) throw error;
    req.flash("error_msg", "A product with that barcode already exists.");
    return res.redirect("/admin/products");
  }
  if (imageUrl && product.imageUrl) await removeProductImage(product.imageUrl);
  req.flash("success_msg", "Product updated.");
  res.redirect("/admin/products");
};

export const updateAllProducts = async (req, res) => {
  let updates;
  try {
    updates = JSON.parse(req.body.updates);
  } catch {
    return res.status(400).json({ message: "Invalid product updates." });
  }

  if (!Array.isArray(updates) || updates.length === 0 || updates.length > 1000) {
    return res.status(400).json({ message: "No products to update or too many products selected." });
  }

  const parsedUpdates = updates.map((update) => {
    if (!update || typeof update !== "object" || Array.isArray(update)) return null;
    const id = Number(update.id);
    const values = productInput(update);
    return Number.isSafeInteger(id) && id > 0 && values ? { id, values, stockReason: update.stockReason } : null;
  });
  const ids = parsedUpdates.map((update) => update && update.id);
  if (parsedUpdates.some((update) => !update) || new Set(ids).size !== ids.length) {
    return res.status(400).json({ message: "Check the product details and try again." });
  }

  const categoryIds = [...new Set(parsedUpdates.map(({ values }) => values.categoryId).filter(Boolean))];
  if (categoryIds.length) {
    const categories = await Category.findAll({ where: { id: categoryIds }, attributes: ["id"] });
    if (categories.length !== categoryIds.length) {
      return res.status(400).json({ message: "One or more selected categories could not be found." });
    }
  }

  const imageUrls = new Map();
  const previousImageUrls = [];
  try {
    for (const file of req.files || []) {
      const match = /^image_(\d+)$/.exec(file.fieldname);
      const id = match && Number(match[1]);
      if (!id || !ids.includes(id) || imageUrls.has(id)) {
        const error = new Error("Invalid product picture in the update.");
        error.status = 400;
        throw error;
      }
      imageUrls.set(id, await saveProductImage(file));
    }

    await sequelize.transaction(async (transaction) => {
      const products = await Product.findAll({
        where: { id: { [Op.in]: ids }, isActive: true },
        order: [["id", "ASC"]],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (products.length !== parsedUpdates.length) {
        const error = new Error("One or more products are no longer active.");
        error.status = 404;
        throw error;
      }

      const productById = new Map(products.map((product) => [product.id, product]));
      for (const { id, values, stockReason } of parsedUpdates) {
        const product = productById.get(id);
        const previousStock = product.stock;
        const imageUrl = imageUrls.get(id);
        if (imageUrl && product.imageUrl) previousImageUrls.push(product.imageUrl);
        product.set({ ...values, ...(imageUrl ? { imageUrl } : {}) });
        await product.save({ transaction });

        const quantityChange = values.stock - previousStock;
        if (quantityChange !== 0) {
          const isRestock = quantityChange > 0 && stockReason === "restock";
          await StockHistory.create({
            productId: product.id,
            userId: req.user.id,
            movementType: isRestock ? "restock" : "adjustment",
            quantityChange,
            stockBalance: values.stock,
            note: isRestock ? "Manual restock" : "Manual stock adjustment",
          }, { transaction });
        }
      }
    });
  } catch (error) {
    for (const imageUrl of imageUrls.values()) await removeProductImage(imageUrl);
    if (error.status === 404) {
      return res.status(404).json({ message: error.message });
    }
    if (error instanceof UniqueConstraintError) {
      return res.status(409).json({ message: "A product with that barcode already exists." });
    }
    if (error.status === 400) {
      return res.status(400).json({ message: error.message });
    }
    throw error;
  }

  for (const imageUrl of previousImageUrls) await removeProductImage(imageUrl);
  req.flash("success_msg", `${parsedUpdates.length} active products updated.`);
  res.json({ success: true });
};

export const deactivateProduct = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    req.flash("error_msg", "Invalid product.");
    return res.redirect("/admin/products");
  }
  const [updated] = await Product.update(
    { isActive: false },
    { where: { id, isActive: true } }
  );
  req.flash(updated ? "success_msg" : "error_msg", updated ? "Product removed from sale." : "Product not found.");
  res.redirect("/admin/products");
};

export const createCategory = async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) {
    req.flash("error_msg", "Enter a category name.");
    return res.redirect("/admin/products");
  }

  try {
    await Category.create({ name });
    req.flash("success_msg", "Category added.");
  } catch (error) {
    if (!(error instanceof UniqueConstraintError)) throw error;
    req.flash("error_msg", "A category with that name already exists.");
  }
  res.redirect("/admin/products");
};
