import "dotenv/config";
import { Category, initializeDatabase, Product, sequelize } from "../models/index.js";

const products = [
  { name: "Drinking Water 500ml", barcode: "DAL000001", price: "15.00", stock: 24, category: "Drinks" },
  { name: "Soft Drink 250ml", barcode: "DAL000002", price: "20.00", stock: 24, category: "Drinks" },
  { name: "Bottled Iced Tea 350ml", barcode: "DAL000003", price: "25.00", stock: 12, category: "Drinks" },
  { name: "Instant Noodles", barcode: "DAL000004", price: "18.00", stock: 30, category: "Snacks" },
  { name: "Potato Chips Small Pack", barcode: "DAL000005", price: "15.00", stock: 20, category: "Snacks" },
  { name: "Assorted Candy", barcode: "DAL000006", price: "2.00", stock: 100, category: "Snacks" },
  { name: "Canned Sardines 155g", barcode: "DAL000007", price: "30.00", stock: 18, category: "Canned Goods" },
  { name: "White Bread Loaf", barcode: "DAL000008", price: "65.00", stock: 8, category: "Grocery" },
  { name: "Laundry Detergent Sachet", barcode: "DAL000009", price: "8.00", stock: 40, category: "Household" },
  { name: "Bath Soap Bar", barcode: "DAL000010", price: "25.00", stock: 16, category: "Household" },
];

try {
  await initializeDatabase();
  const transaction = await sequelize.transaction();
  let added = 0;
  let existing = 0;

  try {
    for (const item of products) {
      const [category] = await Category.findOrCreate({
        where: { name: item.category },
        defaults: { name: item.category },
        transaction,
      });
      const [, created] = await Product.findOrCreate({
        where: { barcode: item.barcode },
        defaults: {
          name: item.name,
          barcode: item.barcode,
          price: item.price,
          stock: item.stock,
          categoryId: category.id,
        },
        transaction,
      });
      if (created) added += 1;
      else existing += 1;
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }

  console.log(`Sample products added: ${added}; already present: ${existing}.`);
} catch (error) {
  console.error("Could not seed sample products:", error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
