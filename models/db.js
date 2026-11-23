import { DataTypes, Sequelize } from "sequelize";

const databaseName = process.env.DB_NAME || "Dali_pos";
const username = process.env.DB_USER || "root";
const password = process.env.DB_PASSWORD || "";
const host = process.env.DB_HOST || "localhost";
const port = Number(process.env.DB_PORT || 3306);

export const sequelize = new Sequelize(databaseName, username, password, {
  host,
  port,
  dialect: "mysql",
  logging: false,
});

export const initializeDatabase = async () => {
  if (!/^[A-Za-z0-9_$-]{1,64}$/.test(databaseName)) {
    throw new Error("DB_NAME must contain only letters, numbers, underscores, or hyphens.");
  }

  const serverConnection = new Sequelize({
    host,
    port,
    username,
    password,
    dialect: "mysql",
    logging: false,
  });

  try {
    await serverConnection.query(
      `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await serverConnection.close();
  }

  await sequelize.authenticate();
  await sequelize.sync();

  const productColumns = await sequelize.getQueryInterface().describeTable("products");
  if (!productColumns.cost_price) {
    await sequelize.getQueryInterface().addColumn("products", "cost_price", {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: "0.00",
    });
  }

  const itemColumns = await sequelize.getQueryInterface().describeTable("transaction_items");
  if (!itemColumns.unit_cost) {
    await sequelize.getQueryInterface().addColumn("transaction_items", "unit_cost", {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: "0.00",
    });
  }

  if (!productColumns.image_url) {
    await sequelize.getQueryInterface().addColumn("products", "image_url", {
      type: DataTypes.STRING(255),
      allowNull: true,
    });
  }

  const transactionColumns = await sequelize.getQueryInterface().describeTable("transactions");
  if (!transactionColumns.customer_name) {
    await sequelize.getQueryInterface().addColumn("transactions", "customer_name", {
      type: DataTypes.STRING(120),
      allowNull: false,
      defaultValue: "Walk-in customer",
    });
  }
  if (!transactionColumns.subtotal) {
    await sequelize.getQueryInterface().addColumn("transactions", "subtotal", {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    });
    await sequelize.query("UPDATE transactions SET subtotal = total WHERE subtotal IS NULL");
    await sequelize.getQueryInterface().changeColumn("transactions", "subtotal", {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    });
  }
  if (!transactionColumns.tax_amount) {
    await sequelize.getQueryInterface().addColumn("transactions", "tax_amount", {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: "0.00",
    });
  }
  if (!transactionColumns.payment_method) {
    await sequelize.getQueryInterface().addColumn("transactions", "payment_method", {
      type: DataTypes.ENUM("cash", "gcash", "maya", "card"),
      allowNull: false,
      defaultValue: "cash",
    });
  }
  if (!transactionColumns.amount_tendered) {
    await sequelize.getQueryInterface().addColumn("transactions", "amount_tendered", {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    });
    await sequelize.query("UPDATE transactions SET amount_tendered = total");
    await sequelize.getQueryInterface().changeColumn("transactions", "amount_tendered", {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    });
  }
  if (!transactionColumns.change_given) {
    await sequelize.getQueryInterface().addColumn("transactions", "change_given", {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: "0.00",
    });
  }
};
