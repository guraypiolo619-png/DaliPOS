import "dotenv/config";
import bcrypt from "bcrypt";
import { initializeDatabase, sequelize, User } from "../models/index.js";

const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
  console.error("Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD (at least 12 characters).");
  process.exitCode = 1;
} else {
  try {
    await initializeDatabase();
    const email = ADMIN_EMAIL.trim().toLowerCase();
    const existing = await User.findOne({ where: { email } });

    if (existing) {
      throw new Error(`A user with ${email} already exists.`);
    }

    const password = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await User.create({ name: ADMIN_NAME.trim(), email, password, role: "admin" });
    console.log(`Admin account created for ${email}.`);
  } catch (error) {
    console.error("Could not create the admin account:", error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}
