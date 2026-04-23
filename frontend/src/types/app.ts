export type UserRole = "admin" | "user";
export type AccessStatus = "pending" | "approved" | "denied";
export type CallMode = "audio" | "video";
export type AudioRoute = "SPEAKER_PHONE" | "EARPIECE" | "WIRED_HEADSET" | "BLUETOOTH" | "NONE";
export type BuiltInAudioRoute = "SPEAKER_PHONE" | "EARPIECE";
export type ExternalAudioRoute = "WIRED_HEADSET" | "BLUETOOTH";

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

export type CallIdentityProof = {
  version: 1;
  publicKey: string;
  signature: string;
  fingerprintAlgorithm: string;
  fingerprint: string;
};
