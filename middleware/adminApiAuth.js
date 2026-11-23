import { User } from "../models/index.js";

export const requireAdminApi = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({
      error: { code: "UNAUTHENTICATED", message: "Sign in as an administrator to continue." },
    });
  }

  User.findByPk(req.session.user.id)
    .then((user) => {
      if (!user || !user.isActive) {
        return req.session.destroy((error) => {
          if (error) return next(error);
          res.clearCookie("connect.sid");
          res.status(401).json({
            error: { code: "UNAUTHENTICATED", message: "The current account is unavailable." },
          });
        });
      }

      if (user.role !== "admin") {
        return res.status(403).json({
          error: { code: "FORBIDDEN", message: "Administrator access is required." },
        });
      }

      req.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isAdmin: true,
      };
      next();
    })
    .catch(next);
};
