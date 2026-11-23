import bcrypt from "bcrypt";
import { UniqueConstraintError } from "sequelize";
import { User } from "../models/index.js";

export const userList = async (req, res) => {
  const rows = await User.findAll({ attributes: ["id", "name", "email", "role", "isActive"], order: [["name", "ASC"]] });
  const users = rows.map((user) => ({
    ...user.get({ plain: true }),
    roleIsAdmin: user.role === "admin",
  }));
  res.render("users", { title: "Users", users });
};

export const createUser = async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const role = req.body.role === "admin" ? "admin" : req.body.role === "staff" ? "staff" : "";

  if (!name || name.length > 255 || email.length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || !role) {
    req.flash("error_msg", "Complete all fields. Passwords must be at least 12 characters.");
    return res.redirect("/admin/users");
  }

  try {
    await User.create({ name, email, password: await bcrypt.hash(password, 12), role });
    req.flash("success_msg", "User account created.");
  } catch (error) {
    if (!(error instanceof UniqueConstraintError)) throw error;
    req.flash("error_msg", "An account with that email already exists.");
  }
  res.redirect("/admin/users");
};

export const updateUser = async (req, res) => {
  const id = Number(req.params.id);
  const name = String(req.body.name || "").trim();
  const role = req.body.role === "admin" ? "admin" : req.body.role === "staff" ? "staff" : "";
  const password = String(req.body.password || "");
  const user = await User.findByPk(id);

  if (!Number.isSafeInteger(id) || id < 1 || !user || !name || name.length > 255 ||
      !role || (password && password.length < 12)) {
    req.flash("error_msg", "Unable to update the user. Check the submitted details.");
    return res.redirect("/admin/users");
  }
  if (id === req.user.id && role !== "admin") {
    req.flash("error_msg", "You cannot remove your own admin access.");
    return res.redirect("/admin/users");
  }
  if (user.role === "admin" && role !== "admin") {
    const adminCount = await User.count({ where: { role: "admin", isActive: true } });
    if (adminCount <= 1) {
      req.flash("error_msg", "The last active admin cannot be demoted.");
      return res.redirect("/admin/users");
    }
  }

  user.name = name;
  user.role = role;
  if (password) user.password = await bcrypt.hash(password, 12);
  await user.save();
  if (id === req.user.id) req.session.user.name = name;
  req.flash("success_msg", "User account updated.");
  res.redirect("/admin/users");
};

export const toggleUser = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    req.flash("error_msg", "Invalid user account.");
    return res.redirect("/admin/users");
  }
  const user = await User.findByPk(id);

  if (!user || id === req.user.id) {
    req.flash("error_msg", "You cannot change this account's status.");
    return res.redirect("/admin/users");
  }
  if (user.isActive && user.role === "admin") {
    const adminCount = await User.count({ where: { role: "admin", isActive: true } });
    if (adminCount <= 1) {
      req.flash("error_msg", "The last active admin cannot be disabled.");
      return res.redirect("/admin/users");
    }
  }

  user.isActive = !user.isActive;
  await user.save();
  req.flash("success_msg", user.isActive ? "Account activated." : "Account disabled.");
  res.redirect("/admin/users");
};
