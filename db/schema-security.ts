import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./schema";

export const adminMfaSettings = sqliteTable("admin_mfa_settings", {
  userId: text("user_id").primaryKey().notNull().references(() => users.id, { onDelete: "cascade" }),
  secretCiphertext: text("secret_ciphertext"),
  secretIv: text("secret_iv"),
  secretKeyVersion: text("secret_key_version"),
  pendingSecretCiphertext: text("pending_secret_ciphertext"),
  pendingSecretIv: text("pending_secret_iv"),
  pendingKeyVersion: text("pending_key_version"),
  pendingCreatedAt: text("pending_created_at"),
  enabledAt: text("enabled_at"),
  lastTotpStep: integer("last_totp_step"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const adminMfaRecoveryCodes = sqliteTable("admin_mfa_recovery_codes", {
  id: text("id").primaryKey().notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull(),
  createdAt: text("created_at").notNull(),
  usedAt: text("used_at"),
}, (table) => [index("admin_mfa_recovery_user_used_idx").on(table.userId, table.usedAt)]);

export const userSecurityState = sqliteTable("user_security_state", {
  userId: text("user_id").primaryKey().notNull().references(() => users.id, { onDelete: "cascade" }),
  failedPasswordAttempts: integer("failed_password_attempts").notNull().default(0),
  lockedUntil: integer("locked_until"),
  lastPasswordFailureAt: text("last_password_failure_at"),
  passwordChangedAt: text("password_changed_at"),
  securityVersion: integer("security_version").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("user_security_locked_idx").on(table.lockedUntil)]);

export const userPasswordHistory = sqliteTable("user_password_history", {
  id: text("id").primaryKey().notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("user_password_history_user_created_idx").on(table.userId, table.createdAt)]);
