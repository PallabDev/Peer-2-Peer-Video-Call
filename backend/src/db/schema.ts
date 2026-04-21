import {
    boolean,
    index,
    jsonb,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "user"]);
export const accessStatusEnum = pgEnum("access_status", ["pending", "approved", "denied"]);
export const callModeEnum = pgEnum("call_mode", ["audio", "video"]);
export const callStatusEnum = pgEnum("call_status", [
    "initiated",
    "ringing",
    "answered",
    "declined",
    "missed",
    "ended",
    "failed",
    "cancelled",
]);

export const usersTable = pgTable("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    firstName: varchar("first_name", { length: 80 }).notNull(),
    lastName: varchar("last_name", { length: 80 }),
    email: varchar("email", { length: 322 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").default("user").notNull(),
    accessStatus: accessStatusEnum("access_status").default("pending").notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    expoPushToken: text("expo_push_token"),
    approvedBy: uuid("approved_by"),
    approvedAt: timestamp("approved_at"),
    verifiedAt: timestamp("verified_at"),
    lastLoginAt: timestamp("last_login_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
    emailIdx: index("users_email_idx").on(table.email),
}));

export const emailVerificationTokensTable = pgTable("email_verification_tokens", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    consumedAt: timestamp("consumed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const passwordResetTokensTable = pgTable("password_reset_tokens", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    consumedAt: timestamp("consumed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const callLogsTable = pgTable("call_logs", {
    id: uuid("id").primaryKey().defaultRandom(),
    callerId: uuid("caller_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    calleeId: uuid("callee_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    mode: callModeEnum("mode").notNull(),
    status: callStatusEnum("status").default("initiated").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>().default(null),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    answeredAt: timestamp("answered_at"),
    endedAt: timestamp("ended_at"),
});
