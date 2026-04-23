import { create } from "zustand";
import {
  clearAppLockConfig,
  getBiometricSupport,
  loadAppLockConfig,
  saveAppLockConfig,
  verifyAppLockPin,
} from "../services/app-lock";

type AppLockState = {
  loading: boolean;
  currentUserId: string | null;
  enabled: boolean;
  isLocked: boolean;
  biometricRequired: boolean;
  biometricAvailable: boolean;
  biometricLabel: string;
  bootstrap: (userId: string | null) => Promise<void>;
  saveSettings: (userId: string, input: { pin?: string; biometricRequired: boolean; }) => Promise<void>;
  disable: (userId: string) => Promise<void>;
  verifyPin: (userId: string, pin: string) => Promise<boolean>;
  lock: () => void;
  unlock: () => void;
};

const initialState = {
  loading: true,
  currentUserId: null,
  enabled: false,
  isLocked: false,
  biometricRequired: false,
  biometricAvailable: false,
  biometricLabel: "biometric verification",
};

export const useAppLockStore = create<AppLockState>((set, get) => ({
  ...initialState,
  bootstrap: async (userId) => {
    set({ loading: true });

    const biometricSupport = await getBiometricSupport();

    if (!userId) {
      set({
        ...initialState,
        loading: false,
        biometricAvailable: biometricSupport.available,
        biometricLabel: biometricSupport.label,
      });
      return;
    }

    const config = await loadAppLockConfig(userId);
    set({
      loading: false,
      currentUserId: userId,
      enabled: Boolean(config?.enabled),
      isLocked: Boolean(config?.enabled),
      biometricRequired: Boolean(config?.biometricRequired && biometricSupport.available),
      biometricAvailable: biometricSupport.available,
      biometricLabel: biometricSupport.label,
    });
  },
  saveSettings: async (userId, input) => {
    const biometricRequired = input.biometricRequired && get().biometricAvailable;
    const config = await saveAppLockConfig(userId, {
      pin: input.pin,
      biometricRequired,
    });

    set({
      currentUserId: userId,
      enabled: config.enabled,
      biometricRequired: config.biometricRequired,
      isLocked: false,
    });
  },
  disable: async (userId) => {
    await clearAppLockConfig(userId);
    set({
      currentUserId: userId,
      enabled: false,
      biometricRequired: false,
      isLocked: false,
    });
  },
  verifyPin: async (userId, pin) => verifyAppLockPin(userId, pin),
  lock: () => {
    if (get().enabled) {
      set({ isLocked: true });
    }
  },
  unlock: () => set({ isLocked: false }),
}));
