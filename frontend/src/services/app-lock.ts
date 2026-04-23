import * as Crypto from "expo-crypto";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

export type AppLockConfig = {
  enabled: boolean;
  biometricRequired: boolean;
  pinHash: string;
  updatedAt: string;
};

export type BiometricSupport = {
  available: boolean;
  label: string;
};

const APP_LOCK_CONFIG_PREFIX = "callie.app-lock";
const APP_LOCK_HASH_PEPPER = "callie.app-lock.v1";

const getConfigKey = (userId: string) => `${APP_LOCK_CONFIG_PREFIX}.${userId}`;

const getBiometricLabel = (types: LocalAuthentication.AuthenticationType[]) => {
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return "fingerprint";
  }

  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return "face recognition";
  }

  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return "iris scan";
  }

  return "biometric verification";
};

export async function getBiometricSupport(): Promise<BiometricSupport> {
  const [hasHardware, isEnrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);

  if (!hasHardware || !isEnrolled) {
    return {
      available: false,
      label: "biometric verification",
    };
  }

  return {
    available: true,
    label: getBiometricLabel(types),
  };
}

export async function loadAppLockConfig(userId: string): Promise<AppLockConfig | null> {
  const raw = await SecureStore.getItemAsync(getConfigKey(userId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppLockConfig>;
    if (
      typeof parsed.enabled !== "boolean" ||
      typeof parsed.biometricRequired !== "boolean" ||
      typeof parsed.pinHash !== "string" ||
      !parsed.pinHash
    ) {
      return null;
    }

    return {
      enabled: parsed.enabled,
      biometricRequired: parsed.biometricRequired,
      pinHash: parsed.pinHash,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function buildPinHash(userId: string, pin: string) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${APP_LOCK_HASH_PEPPER}:${userId}:${pin}`,
  );
}

export async function saveAppLockConfig(
  userId: string,
  input: {
    pin?: string;
    biometricRequired: boolean;
  },
) {
  const existing = await loadAppLockConfig(userId);
  const pinHash = input.pin ? await buildPinHash(userId, input.pin) : existing?.pinHash;

  if (!pinHash) {
    throw new Error("A 4-digit PIN is required.");
  }

  const config: AppLockConfig = {
    enabled: true,
    biometricRequired: input.biometricRequired,
    pinHash,
    updatedAt: new Date().toISOString(),
  };

  await SecureStore.setItemAsync(getConfigKey(userId), JSON.stringify(config));
  return config;
}

export async function clearAppLockConfig(userId: string) {
  await SecureStore.deleteItemAsync(getConfigKey(userId));
}

export async function verifyAppLockPin(userId: string, pin: string) {
  const config = await loadAppLockConfig(userId);
  if (!config?.pinHash) {
    return false;
  }

  const pinHash = await buildPinHash(userId, pin);
  return pinHash === config.pinHash;
}
