export type UserRole = "admin" | "user";
export type AccessStatus = "pending" | "approved" | "denied";
export type CallMode = "audio" | "video";

export type User = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  role: UserRole;
  accessStatus: AccessStatus;
  emailVerified: boolean;
  expoPushToken: string | null;
  approvedAt: string | null;
  createdAt: string;
};

export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type Contact = User;

export type CallSession = {
  callId: string;
  remoteUserId: string;
  remoteUserName: string;
  mode: CallMode;
  direction: "incoming" | "outgoing";
};
