import { create } from "zustand";
import type { CallMode, CallSession } from "../types/app";

type CallState = {
  incomingCall: CallSession | null;
  activeCall: CallSession | null;
  status: "idle" | "ringing" | "incoming" | "connecting" | "connected" | "ended" | "error";
  localStreamUrl: string | null;
  remoteStreamUrl: string | null;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isSpeakerOn: boolean;
  cameraFacing: "front" | "back";
  errorMessage: string | null;
  setIncomingCall: (call: CallSession | null) => void;
  setActiveCall: (call: CallSession | null) => void;
  setStatus: (status: CallState["status"]) => void;
  setLocalStreamUrl: (url: string | null) => void;
  setRemoteStreamUrl: (url: string | null) => void;
  setMuted: (value: boolean) => void;
  setVideoEnabled: (value: boolean) => void;
  setSpeakerOn: (value: boolean) => void;
  setCameraFacing: (value: "front" | "back") => void;
  setErrorMessage: (value: string | null) => void;
  reset: () => void;
};

const initialState = {
  incomingCall: null,
  activeCall: null,
  status: "idle" as const,
  localStreamUrl: null,
  remoteStreamUrl: null,
  isMuted: false,
  isVideoEnabled: true,
  isSpeakerOn: false,
  cameraFacing: "front" as const,
  errorMessage: null,
};

export const useCallStore = create<CallState>((set) => ({
  ...initialState,
  setIncomingCall: (call) => set({
    incomingCall: call,
    status: call ? "incoming" : "idle",
  }),
  setActiveCall: (call) => set({ activeCall: call }),
  setStatus: (status) => set({ status }),
  setLocalStreamUrl: (localStreamUrl) => set({ localStreamUrl }),
  setRemoteStreamUrl: (remoteStreamUrl) => set({ remoteStreamUrl }),
  setMuted: (isMuted) => set({ isMuted }),
  setVideoEnabled: (isVideoEnabled) => set({ isVideoEnabled }),
  setSpeakerOn: (isSpeakerOn) => set({ isSpeakerOn }),
  setCameraFacing: (cameraFacing) => set({ cameraFacing }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
  reset: () => set(initialState),
}));
