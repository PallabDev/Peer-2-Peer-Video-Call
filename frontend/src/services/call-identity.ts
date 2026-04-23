import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";
import type { CallIdentityProof } from "../types/app";

type StoredLocalIdentity = {
  publicKey: string;
  secretKey: string;
  createdAt: string;
  version: 1;
};

type StoredPeerIdentity = {
  publicKey: string;
  firstSeenAt: string;
  lastSeenAt: string;
  version: 1;
};

type VerificationResult = {
  status: "verified" | "unverified";
  reason?: string;
};

const LOCAL_IDENTITY_PREFIX = "callie.call-identity.local";
const PEER_IDENTITY_PREFIX = "callie.call-identity.peer";

const getLocalIdentityKey = (userId: string) => `${LOCAL_IDENTITY_PREFIX}.${userId}`;
const getPeerIdentityKey = (userId: string, peerUserId: string) => `${PEER_IDENTITY_PREFIX}.${userId}.${peerUserId}`;

function parseFingerprintFromSdp(sdp: string) {
  const match = sdp.match(/^a=fingerprint:\s*([^\s]+)\s+([^\r\n]+)/m);
  if (!match) {
    throw new Error("Missing DTLS fingerprint in call negotiation.");
  }

  const algorithm = match[1]?.trim().toUpperCase();
  const value = match[2]?.trim().replace(/\s+/g, "").toUpperCase();

  if (!algorithm || !value) {
    throw new Error("Invalid DTLS fingerprint in call negotiation.");
  }

  return {
    algorithm,
    value,
  };
}

function buildSignedMessage(callId: string, algorithm: string, fingerprint: string) {
  return naclUtil.decodeUTF8(`${callId}:${algorithm}:${fingerprint}`);
}

async function loadLocalIdentity(userId: string) {
  const raw = await SecureStore.getItemAsync(getLocalIdentityKey(userId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredLocalIdentity>;
    if (
      typeof parsed.publicKey !== "string" ||
      typeof parsed.secretKey !== "string" ||
      !parsed.publicKey ||
      !parsed.secretKey
    ) {
      return null;
    }

    return {
      publicKey: parsed.publicKey,
      secretKey: parsed.secretKey,
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
      version: 1 as const,
    };
  } catch {
    return null;
  }
}

async function ensureLocalIdentity(userId: string) {
  const existing = await loadLocalIdentity(userId);
  if (existing) {
    return existing;
  }

  const seed = Crypto.getRandomBytes(32);
  const keyPair = nacl.sign.keyPair.fromSeed(seed);
  const identity: StoredLocalIdentity = {
    publicKey: naclUtil.encodeBase64(keyPair.publicKey),
    secretKey: naclUtil.encodeBase64(keyPair.secretKey),
    createdAt: new Date().toISOString(),
    version: 1,
  };

  await SecureStore.setItemAsync(getLocalIdentityKey(userId), JSON.stringify(identity));
  return identity;
}

async function loadPeerIdentity(userId: string, peerUserId: string) {
  const raw = await SecureStore.getItemAsync(getPeerIdentityKey(userId, peerUserId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredPeerIdentity>;
    if (typeof parsed.publicKey !== "string" || !parsed.publicKey) {
      return null;
    }

    return {
      publicKey: parsed.publicKey,
      firstSeenAt: typeof parsed.firstSeenAt === "string" ? parsed.firstSeenAt : new Date().toISOString(),
      lastSeenAt: typeof parsed.lastSeenAt === "string" ? parsed.lastSeenAt : new Date().toISOString(),
      version: 1 as const,
    };
  } catch {
    return null;
  }
}

async function savePeerIdentity(userId: string, peerUserId: string, publicKey: string, firstSeenAt?: string) {
  const payload: StoredPeerIdentity = {
    publicKey,
    firstSeenAt: firstSeenAt ?? new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    version: 1,
  };

  await SecureStore.setItemAsync(getPeerIdentityKey(userId, peerUserId), JSON.stringify(payload));
}

export async function buildCallIdentityProof(userId: string, callId: string, sdp: string): Promise<CallIdentityProof> {
  const identity = await ensureLocalIdentity(userId);
  const fingerprint = parseFingerprintFromSdp(sdp);
  const signature = nacl.sign.detached(
    buildSignedMessage(callId, fingerprint.algorithm, fingerprint.value),
    naclUtil.decodeBase64(identity.secretKey),
  );

  return {
    version: 1,
    publicKey: identity.publicKey,
    signature: naclUtil.encodeBase64(signature),
    fingerprintAlgorithm: fingerprint.algorithm,
    fingerprint: fingerprint.value,
  };
}

export async function verifyRemoteCallIdentity(input: {
  localUserId: string;
  remoteUserId: string;
  callId: string;
  sdp: string;
  proof?: CallIdentityProof | null;
}): Promise<VerificationResult> {
  if (!input.proof) {
    return {
      status: "unverified",
      reason: "Missing signed device identity from the other side.",
    };
  }

  const fingerprint = parseFingerprintFromSdp(input.sdp);
  const normalizedProofFingerprint = input.proof.fingerprint.trim().replace(/\s+/g, "").toUpperCase();
  const normalizedProofAlgorithm = input.proof.fingerprintAlgorithm.trim().toUpperCase();

  if (
    normalizedProofFingerprint !== fingerprint.value ||
    normalizedProofAlgorithm !== fingerprint.algorithm
  ) {
    return {
      status: "unverified",
      reason: "The signed device key did not match the live call fingerprint.",
    };
  }

  const signatureValid = nacl.sign.detached.verify(
    buildSignedMessage(input.callId, fingerprint.algorithm, fingerprint.value),
    naclUtil.decodeBase64(input.proof.signature),
    naclUtil.decodeBase64(input.proof.publicKey),
  );

  if (!signatureValid) {
    return {
      status: "unverified",
      reason: "The other side sent an invalid signed device key.",
    };
  }

  const knownPeerIdentity = await loadPeerIdentity(input.localUserId, input.remoteUserId);

  if (!knownPeerIdentity) {
    await savePeerIdentity(input.localUserId, input.remoteUserId, input.proof.publicKey);
    return { status: "verified" };
  }

  if (knownPeerIdentity.publicKey !== input.proof.publicKey) {
    return {
      status: "unverified",
      reason: "This contact's security key changed unexpectedly. The call was blocked.",
    };
  }

  await savePeerIdentity(
    input.localUserId,
    input.remoteUserId,
    input.proof.publicKey,
    knownPeerIdentity.firstSeenAt,
  );

  return { status: "verified" };
}
