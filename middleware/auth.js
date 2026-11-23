import { Product, User } from "../models/index.js";
import { Op } from "sequelize";

export const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    req.flash("error_msg", "Please sign in to continue.");
    return res.redirect("/login");
  }

  User.findByPk(req.session.user.id)
    .then((user) => {
      if (!user || !user.isActive) {
        return req.session.destroy((error) => {
          if (error) return next(error);
          res.clearCookie("connect.sid");
          res.redirect("/login");
        });
      }

      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isAdmin: user.role === "admin",
      };
      req.user = req.session.user;
      res.locals.user = req.user;
      Product.count({ where: { isActive: true, stock: { [Op.lte]: 10 } } })
        .then((lowStockCount) => {
          res.locals.lowStockCount = lowStockCount;
          next();
        })
        .catch(next);
    })
    .catch(next);
};

export const requireRole = (...roles) => (req, res, next) => {
  requireAuth(req, res, (error) => {
    if (error) return next(error);
    if (!roles.includes(req.user.role)) {
      return res.status(403).render("error", {
        title: "Access denied",
        message: "You do not have permission to access this page.",
      });
    }
    next();
  });
};
