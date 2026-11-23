import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const ActivityLog = sequelize.define("ActivityLog", {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: "user_id" },
  userName: { type: DataTypes.STRING(255), allowNull: false, field: "user_name" },
  role: { type: DataTypes.ENUM("admin", "staff"), allowNull: false },
  action: { type: DataTypes.ENUM("login", "logout"), allowNull: false },
  sessionId: { type: DataTypes.STRING(128), allowNull: false, field: "session_id" },
  occurredAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "occurred_at" },
  sessionDurationSeconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: "session_duration_seconds" },
  status: { type: DataTypes.ENUM("active", "offline"), allowNull: false },
}, {
  tableName: "activity_logs",
  timestamps: false,
  underscored: true,
});
