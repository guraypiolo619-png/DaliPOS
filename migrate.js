import "dotenv/config";
import { initializeDatabase, sequelize } from "./models/index.js";

try {
  await initializeDatabase();
  console.log("Database and tables are ready.");
} catch (error) {
  console.error("Could not prepare database tables:", error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
