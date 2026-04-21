import { and, count, desc, eq, isNull, ne } from "drizzle-orm";
import { db } from "../../db/db-connect";
import {
    callLogsTable,
    emailVerificationTokensTable,
    passwordResetTokensTable,
    usersTable,
} from "../../db/schema";
import { ACCESS_STATUS, USER_ROLES } from "../constants/user";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiErrors";
import { safeUserSelect } from "../utils/safe-user";
import { buildEmailVerificationLink, buildResetPasswordLink, generateOpaqueToken, hashOpaqueToken } from "./token.service";
import { sendResetPasswordEmail, sendVerificationEmail } from "./email.service";
import { hashPassword, verifyPassword } from "./password.service";

type RegisterInput = {
    firstName: string;
    lastName?: string;
    email: string;
    password: string;
};

export const createUser = async (input: RegisterInput) => {
    const email = input.email.trim().toLowerCase();
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));

    if (existing) {
        throw new ApiError(409, "An account with this email already exists.");
    }

    const passwordHash = await hashPassword(input.password);

    const [createdUser] = await db.insert(usersTable).values({
        firstName: input.firstName.trim(),
        lastName: input.lastName?.trim() || null,
        email,
        passwordHash,
        role: USER_ROLES.USER,
        accessStatus: ACCESS_STATUS.PENDING,
        approvedAt: null,
    }).returning(safeUserSelect);

    if (!createdUser) {
        throw new ApiError(500, "Could not create the user.");
    }

    await createVerificationToken(createdUser.id, createdUser.email, createdUser.firstName);
    return createdUser;
};

export const createVerificationToken = async (userId: string, email: string, firstName: string) => {
    await db.delete(emailVerificationTokensTable).where(and(
        eq(emailVerificationTokensTable.userId, userId),
        isNull(emailVerificationTokensTable.consumedAt),
    ));

    const token = generateOpaqueToken();
    const tokenHash = hashOpaqueToken(token);

    await db.insert(emailVerificationTokensTable).values({
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    });

    await sendVerificationEmail(email, firstName, buildEmailVerificationLink(token));
};

export const createPasswordResetToken = async (userId: string, email: string, firstName: string) => {
    await db.delete(passwordResetTokensTable).where(and(
        eq(passwordResetTokensTable.userId, userId),
        isNull(passwordResetTokensTable.consumedAt),
    ));

    const token = generateOpaqueToken();
    const tokenHash = hashOpaqueToken(token);

    await db.insert(passwordResetTokensTable).values({
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + 1000 * 60 * 30),
    });

    await sendResetPasswordEmail(email, firstName, buildResetPasswordLink(token));
};

export const loginUser = async (email: string, password: string) => {
    const [user] = await db.select({
        ...safeUserSelect,
        passwordHash: usersTable.passwordHash,
    }).from(usersTable).where(eq(usersTable.email, email.trim().toLowerCase()));

    if (!user) {
        throw new ApiError(401, "Invalid email or password.");
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
        throw new ApiError(401, "Invalid email or password.");
    }

    await db.update(usersTable)
        .set({ lastLoginAt: new Date() })
        .where(eq(usersTable.id, user.id));

    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
};

export const verifyEmailToken = async (token: string) => {
    const tokenHash = hashOpaqueToken(token);
    const [record] = await db.select().from(emailVerificationTokensTable).where(eq(emailVerificationTokensTable.tokenHash, tokenHash));

    if (!record || record.consumedAt || record.expiresAt < new Date()) {
        throw new ApiError(400, "Verification token is invalid or has expired.");
    }

    await db.update(emailVerificationTokensTable)
        .set({ consumedAt: new Date() })
        .where(eq(emailVerificationTokensTable.id, record.id));

    await db.update(usersTable)
        .set({ emailVerified: true, verifiedAt: new Date() })
        .where(eq(usersTable.id, record.userId));
};

export const resetPasswordWithToken = async (token: string, newPassword: string) => {
    const tokenHash = hashOpaqueToken(token);
    const [record] = await db.select().from(passwordResetTokensTable).where(eq(passwordResetTokensTable.tokenHash, tokenHash));

    if (!record || record.consumedAt || record.expiresAt < new Date()) {
        throw new ApiError(400, "Reset token is invalid or has expired.");
    }

    const passwordHash = await hashPassword(newPassword);

    await db.update(passwordResetTokensTable)
        .set({ consumedAt: new Date() })
        .where(eq(passwordResetTokensTable.id, record.id));

    await db.update(usersTable)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(usersTable.id, record.userId));
};

export const getUserById = async (userId: string) => {
    const [user] = await db.select(safeUserSelect).from(usersTable).where(eq(usersTable.id, userId));
    if (!user) {
        throw new ApiError(404, "User not found.");
    }
    return user;
};

export const getUserByEmail = async (email: string) => {
    const [user] = await db.select(safeUserSelect).from(usersTable).where(eq(usersTable.email, email.trim().toLowerCase()));
    return user;
};

export const listUsersForAdmin = async () => {
    return db.select(safeUserSelect).from(usersTable).orderBy(desc(usersTable.createdAt));
};

export const updateUserAccessAndRole = async (
    targetUserId: string,
    actorUserId: string,
    input: { accessStatus?: "pending" | "approved" | "denied"; role?: "admin" | "user"; },
) => {
    const [existingUser] = await db.select(safeUserSelect).from(usersTable).where(eq(usersTable.id, targetUserId));
    if (!existingUser) {
        throw new ApiError(404, "User not found.");
    }

    const nextRole = input.role ?? existingUser.role;
    const nextAccessStatus = nextRole === USER_ROLES.ADMIN
        ? ACCESS_STATUS.APPROVED
        : (input.accessStatus ?? existingUser.accessStatus);

    if (nextAccessStatus === ACCESS_STATUS.APPROVED && nextRole !== USER_ROLES.ADMIN) {
        const [approvedUsers] = await db.select({ count: count() }).from(usersTable).where(and(
            eq(usersTable.accessStatus, ACCESS_STATUS.APPROVED),
            ne(usersTable.role, USER_ROLES.ADMIN),
            ne(usersTable.id, targetUserId),
        ));

        if (Number(approvedUsers?.count ?? 0) >= env.MAX_APPROVED_MEMBERS) {
            throw new ApiError(409, `Only ${env.MAX_APPROVED_MEMBERS} approved members are allowed at a time.`);
        }
    }

    const [updatedUser] = await db.update(usersTable).set({
        accessStatus: nextAccessStatus,
        role: nextRole,
        approvedBy: actorUserId,
        approvedAt: nextAccessStatus === ACCESS_STATUS.APPROVED ? new Date() : existingUser.approvedAt,
        updatedAt: new Date(),
    }).where(eq(usersTable.id, targetUserId)).returning(safeUserSelect);

    if (!updatedUser) {
        throw new ApiError(500, "Could not update the user.");
    }

    return updatedUser;
};

export const listApprovedContacts = async (currentUserId: string) => {
    return db.select(safeUserSelect).from(usersTable).where(and(
        ne(usersTable.id, currentUserId),
        eq(usersTable.emailVerified, true),
        eq(usersTable.accessStatus, ACCESS_STATUS.APPROVED),
    ));
};

export const savePushToken = async (userId: string, expoPushToken: string) => {
    const [user] = await db.update(usersTable)
        .set({ expoPushToken, updatedAt: new Date() })
        .where(eq(usersTable.id, userId))
        .returning(safeUserSelect);

    return user;
};

export const listCallHistory = async (userId: string) => {
    return db.select().from(callLogsTable).where(
        eq(callLogsTable.callerId, userId),
    ).orderBy(desc(callLogsTable.startedAt));
};
