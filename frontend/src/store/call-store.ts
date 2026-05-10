import { create } from "zustand";
import type { AudioRoute, BuiltInAudioRoute, CallMode, CallSession, ExternalAudioRoute } from "../types/app";

type CallState = {
  incomingCall: CallSession | null;
  activeCall: CallSession | null;
  status: "idle" | "ringing" | "incoming" | "connecting" | "connected" | "ended" | "error";
  localStreamUrl: string | null;
  remoteStreamUrl: string | null;
  isMuted: boolean;
  isVideoEnabled: boolean;
  preferredBuiltInRoute: BuiltInAudioRoute;
  preferredExternalRoute: ExternalAudioRoute | null;
  activeAudioRoute: AudioRoute;
  availableAudioRoutes: AudioRoute[];
  bluetoothDeviceName: string | null;
  cameraFacing: "front" | "back";
  errorMessage: string | null;
  encryptionStatus: "unknown" | "verified" | "unverified";
  setIncomingCall: (call: CallSession | null) => void;
  setActiveCall: (call: CallSession | null) => void;
  setStatus: (status: CallState["status"]) => void;
  setLocalStreamUrl: (url: string | null) => void;
  setRemoteStreamUrl: (url: string | null) => void;
  setMuted: (value: boolean) => void;
  setVideoEnabled: (value: boolean) => void;
  setPreferredBuiltInRoute: (value: BuiltInAudioRoute) => void;
  setPreferredExternalRoute: (value: ExternalAudioRoute | null) => void;
  setActiveAudioRoute: (value: AudioRoute) => void;
  setAvailableAudioRoutes: (value: AudioRoute[]) => void;
  setBluetoothDeviceName: (value: string | null) => void;
  setCameraFacing: (value: "front" | "back") => void;
  setErrorMessage: (value: string | null) => void;
  setEncryptionStatus: (value: CallState["encryptionStatus"]) => void;
  reset: () => void;
};

const liveCallStatuses: ReadonlyArray<CallState["status"]> = ["ringing", "incoming", "connecting", "connected"];

const initialState = {
  incomingCall: null,
  activeCall: null,
  status: "idle" as const,
  localStreamUrl: null,
  remoteStreamUrl: null,
  isMuted: false,
  isVideoEnabled: true,
  preferredBuiltInRoute: "EARPIECE" as const,
  preferredExternalRoute: null,
  activeAudioRoute: "NONE" as const,
  availableAudioRoutes: [] as AudioRoute[],
  bluetoothDeviceName: null,
  cameraFacing: "front" as const,
  errorMessage: null,
  encryptionStatus: "unknown" as const,
};

export const useCallStore = create<CallState>((set) => ({
  ...initialState,
  setIncomingCall: (call) => set((state) => ({
    incomingCall: call,
    status: call ? "incoming" : state.activeCall ? state.status : "idle",
  })),
  setActiveCall: (call) => set((state) => ({
    activeCall: call,
    status: call ? state.status : state.incomingCall ? "incoming" : "idle",
  })),
  setStatus: (status) => set({ status }),
  setLocalStreamUrl: (localStreamUrl) => set({ localStreamUrl }),
  setRemoteStreamUrl: (remoteStreamUrl) => set({ remoteStreamUrl }),
  setMuted: (isMuted) => set({ isMuted }),
  setVideoEnabled: (isVideoEnabled) => set({ isVideoEnabled }),
  setPreferredBuiltInRoute: (preferredBuiltInRoute) => set({ preferredBuiltInRoute }),
  setPreferredExternalRoute: (preferredExternalRoute) => set({ preferredExternalRoute }),
  setActiveAudioRoute: (activeAudioRoute) => set({ activeAudioRoute }),
  setAvailableAudioRoutes: (availableAudioRoutes) => set({ availableAudioRoutes }),
  setBluetoothDeviceName: (bluetoothDeviceName) => set({ bluetoothDeviceName }),
  setCameraFacing: (cameraFacing) => set({ cameraFacing }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
  setEncryptionStatus: (encryptionStatus) => set({ encryptionStatus }),
  reset: () => set(initialState),
}));

export function hasLiveCall(state: Pick<CallState, "activeCall" | "incomingCall" | "status">) {
  if (state.incomingCall) {
    return true;
  }

  return Boolean(state.activeCall && liveCallStatuses.includes(state.status));
}
