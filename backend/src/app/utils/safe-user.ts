import { usersTable } from "../../db/schema";

export const safeUserSelect = {
    id: usersTable.id,
    firstName: usersTable.firstName,
    lastName: usersTable.lastName,
    email: usersTable.email,
    role: usersTable.role,
    accessStatus: usersTable.accessStatus,
    emailVerified: usersTable.emailVerified,
    expoPushToken: usersTable.expoPushToken,
    approvedAt: usersTable.approvedAt,
    createdAt: usersTable.createdAt,
};
