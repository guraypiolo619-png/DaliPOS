import bcrypt from "bcrypt";
import { ActivityLog, User, sequelize } from "../models/index.js";

export const loginPage = (req, res) => {
  if (req.session.user) {
    return res.redirect("/dashboard");
  }
  res.render("login", { title: "Sign in" });
};

export const login = async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = await User.findOne({ where: { email, isActive: true } });
  const valid = user && await bcrypt.compare(password, user.password);

  if (!valid) {
    req.flash("error_msg", "The email or password is incorrect.");
    return res.redirect("/login");
  }

  await new Promise((resolve, reject) => {
    req.session.regenerate((error) => error ? reject(error) : resolve());
  });
  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isAdmin: user.role === "admin",
  };
  await ActivityLog.create({
    userId: user.id,
    userName: user.name,
    role: user.role,
    action: "login",
    sessionId: req.sessionID,
    occurredAt: new Date(),
    status: "active",
  });
  res.redirect("/dashboard");
};

export const logout = async (req, res, next) => {
  const sessionUser = req.session.user;
  const sessionId = req.sessionID;
  if (sessionUser) {
    await sequelize.transaction(async (transaction) => {
      const loginEvent = await ActivityLog.findOne({
        where: { sessionId, action: "login" },
        order: [["occurredAt", "DESC"]],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const duration = loginEvent
        ? Math.max(0, Math.floor((Date.now() - new Date(loginEvent.occurredAt).getTime()) / 1000))
        : null;
      if (loginEvent) {
        await loginEvent.update({
          status: "offline",
          sessionDurationSeconds: duration,
        }, { transaction });
      }
      await ActivityLog.create({
        userId: sessionUser.id,
        userName: sessionUser.name,
        role: sessionUser.role,
        action: "logout",
        sessionId,
        occurredAt: new Date(),
        sessionDurationSeconds: duration,
        status: "offline",
      }, { transaction });
    });
  }
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
};
