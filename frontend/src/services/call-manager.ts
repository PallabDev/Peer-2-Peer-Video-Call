import { mediaDevices, RTCPeerConnection, RTCIceCandidate, RTCSessionDescription } from "react-native-webrtc";
import type { MediaStream } from "react-native-webrtc";
import InCallManager from "react-native-incall-manager";
import { Alert, DeviceEventEmitter, type EmitterSubscription, PermissionsAndroid, Platform } from "react-native";
import { socketService } from "./socket";
import { useCallStore } from "../store/call-store";
import type { AudioRoute, BuiltInAudioRoute, CallIdentityProof, CallMode, CallSession, Contact } from "../types/app";
import {
  cancelIncomingCallNotification,
  playMissedCallNotification,
} from "./push-notifications";
import { navigationRef } from "../navigation/navigationRef";
import { useAuthStore } from "../store/auth-store";
import { buildCallIdentityProof, verifyRemoteCallIdentity } from "./call-identity";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];
const ANDROID_AUDIO_ROUTE_SYNC_DELAYS = [0, 250, 750, 1500, 3000, 5000];

class CallManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private listenersAttached = false;
  private audioSessionActive = false;
  private audioSessionMedia: CallMode | null = null;
  private audioRouteSyncTimeouts: ReturnType<typeof setTimeout>[] = [];
  private routeChangeSubscription: EmitterSubscription | null = null;
  private outgoingCallPending = false;

  attachSocket() {
    const socket = socketService.getSocket();
    if (!socket || this.listenersAttached) {
      return;
    }

    this.listenersAttached = true;
    this.attachAudioRouteListener();

    socket.on("call:incoming", async (payload: { callId: string; callerId: string; callerName?: string; mode: CallMode; }) => {
      const state = useCallStore.getState();
      if (state.activeCall?.callId === payload.callId || state.incomingCall?.callId === payload.callId) {
        return;
      }

      const incomingCall: CallSession = {
        callId: payload.callId,
        remoteUserId: payload.callerId,
        remoteUserName: payload.callerName ?? "Unknown caller",
        mode: payload.mode,
        direction: "incoming",
      };

      useCallStore.getState().setIncomingCall(incomingCall);
      InCallManager.startRingtone("_DEFAULT_", [0, 250, 250, 250], "playback", 30);
    });

    socket.on("call:busy", (payload: { calleeId?: string; }) => {
      const state = useCallStore.getState();
      if (state.activeCall && (!payload.calleeId || state.activeCall.remoteUserId === payload.calleeId)) {
        useCallStore.getState().setErrorMessage("User is busy on another call");
      }
      InCallManager.stopRingback();
    });

    socket.on("call:accepted", async (payload: { callId: string; }) => {
      const state = useCallStore.getState();
      if (!state.activeCall || state.activeCall.callId !== payload.callId) {
        return;
      }

      InCallManager.stopRingback();
      await this.prepareLocalMedia(state.activeCall.mode);
      await this.createPeerConnection(state.activeCall, true);
      this.setCallStatus("connecting");
    });

    socket.on("call:declined", async () => {
      const { incomingCall } = useCallStore.getState();
      if (incomingCall) {
        await cancelIncomingCallNotification(incomingCall.callId);
      }
      useCallStore.getState().setErrorMessage("Call declined");
      await this.reset();
    });

    socket.on("call:missed", async () => {
      const { incomingCall } = useCallStore.getState();
      if (incomingCall) {
        await playMissedCallNotification(incomingCall);
      }
      useCallStore.getState().setErrorMessage("Call timed out");
      await this.reset();
    });

    socket.on("call:cancelled", async () => {
      const { incomingCall } = useCallStore.getState();
      if (incomingCall) {
        await playMissedCallNotification(incomingCall);
      }
      await this.reset();
    });

    socket.on("call:ended", async () => {
      await this.reset();
    });

    socket.on("webrtc:offer", async (payload: {
      callId: string;
      fromUserId: string;
      sdp: any;
      identity?: CallIdentityProof;
    }) => {
      const activeCall = useCallStore.getState().activeCall;
      if (!activeCall || activeCall.callId !== payload.callId) {
        return;
      }

      if (!this.peerConnection) {
        await this.prepareLocalMedia(activeCall.mode);
        await this.createPeerConnection(activeCall, false);
      }

      const isVerified = await this.verifyRemoteIdentity({
        callId: payload.callId,
        remoteUserId: payload.fromUserId,
        sdp: payload.sdp,
        identity: payload.identity,
      });
      if (!isVerified) {
        return;
      }

      await this.peerConnection?.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      const answer = await this.peerConnection?.createAnswer();
      if (!answer) {
        return;
      }

      await this.peerConnection?.setLocalDescription(answer);
      const identity = await this.buildLocalIdentityProof(activeCall.callId, answer.sdp ?? "");
      if (!identity) {
        return;
      }
      socket.emit("webrtc:answer", {
        callId: activeCall.callId,
        toUserId: payload.fromUserId,
        sdp: answer,
        identity,
      });
      this.setCallStatus("connecting");
    });

    socket.on("webrtc:answer", async (payload: {
      callId: string;
      sdp: any;
      identity?: CallIdentityProof;
    }) => {
      const activeCall = useCallStore.getState().activeCall;
      if (!activeCall || activeCall.callId !== payload.callId) {
        return;
      }

      const isVerified = await this.verifyRemoteIdentity({
        callId: payload.callId,
        remoteUserId: activeCall.remoteUserId,
        sdp: payload.sdp,
        identity: payload.identity,
      });
      if (!isVerified) {
        return;
      }

      await this.peerConnection?.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      this.setCallStatus("connected");
    });

    socket.on("webrtc:ice-candidate", async (payload: { candidate: any; }) => {
      if (!this.peerConnection || !payload.candidate) {
        return;
      }

      await this.peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
    });
  }

  detachSocket() {
    const socket = socketService.getSocket();
    if (!socket || !this.listenersAttached) {
      return;
    }

    socket.removeAllListeners("call:incoming");
    socket.removeAllListeners("call:accepted");
    socket.removeAllListeners("call:busy");
    socket.removeAllListeners("call:declined");
    socket.removeAllListeners("call:missed");
    socket.removeAllListeners("call:cancelled");
    socket.removeAllListeners("call:ended");
    socket.removeAllListeners("webrtc:offer");
    socket.removeAllListeners("webrtc:answer");
    socket.removeAllListeners("webrtc:ice-candidate");
    this.detachAudioRouteListener();
    this.listenersAttached = false;
  }

  async startOutgoingCall(contact: Contact, mode: CallMode) {
    const state = useCallStore.getState();
    if (this.outgoingCallPending || state.activeCall || state.incomingCall) {
      throw new Error("A call is already in progress.");
    }

    const socket = socketService.getSocket();
    if (!socket) {
      throw new Error("Socket is not connected");
    }

    this.outgoingCallPending = true;
    const response = await new Promise<{ success: boolean; callId?: string; message?: string; }>((resolve) => {
      socket.emit("call:initiate", {
        toUserId: contact.id,
        mode,
      }, resolve);
    }).finally(() => {
      this.outgoingCallPending = false;
    });

    if (!response.success || !response.callId) {
      throw new Error(response.message ?? "Could not start the call.");
    }

    const activeCall: CallSession = {
      callId: response.callId,
      remoteUserId: contact.id,
      remoteUserName: `${contact.firstName}${contact.lastName ? ` ${contact.lastName}` : ""}`.trim(),
      mode,
      direction: "outgoing",
    };

    useCallStore.getState().setActiveCall(activeCall);
    useCallStore.getState().setEncryptionStatus("unknown");
    useCallStore.getState().setErrorMessage(null);
    this.setCallStatus("ringing");
    this.applyDefaultAudioPreferences(mode);
    InCallManager.startRingback("_DEFAULT_");
    return activeCall;
  }

  hydrateIncomingCallFromNotification(incomingCall: CallSession) {
    const state = useCallStore.getState();
    if (state.activeCall?.callId === incomingCall.callId || state.incomingCall?.callId === incomingCall.callId) {
      return;
    }

    useCallStore.getState().setIncomingCall(incomingCall);
  }

  async acceptIncomingCall() {
    const incomingCall = useCallStore.getState().incomingCall;
    const socket = await this.waitForSocket();
    if (!incomingCall || !socket) {
      return;
    }

    InCallManager.stopRingtone();
    await cancelIncomingCallNotification(incomingCall.callId);
    useCallStore.getState().setActiveCall(incomingCall);
    useCallStore.getState().setIncomingCall(null);
    useCallStore.getState().setEncryptionStatus("unknown");
    useCallStore.getState().setErrorMessage(null);
    this.setCallStatus("connecting");
    this.applyDefaultAudioPreferences(incomingCall.mode);
    await this.prepareLocalMedia(incomingCall.mode);
    await this.createPeerConnection(incomingCall, false);
    socket.emit("call:accept", { callId: incomingCall.callId });
  }

  async declineIncomingCall() {
    const incomingCall = useCallStore.getState().incomingCall;
    const socket = await this.waitForSocket();
    if (!incomingCall || !socket) {
      return;
    }

    InCallManager.stopRingtone();
    await cancelIncomingCallNotification(incomingCall.callId);
    socket.emit("call:decline", { callId: incomingCall.callId });
    useCallStore.getState().setIncomingCall(null);
  }

  async endCurrentCall() {
    const activeCall = useCallStore.getState().activeCall;
    const socket = socketService.getSocket();
    if (activeCall && socket) {
      const currentStatus = useCallStore.getState().status;
      socket.emit(currentStatus === "ringing" && activeCall.direction === "outgoing" ? "call:cancel" : "call:end", {
        callId: activeCall.callId,
      });
    }
    await this.reset();
  }

  async toggleMute() {
    if (!this.localStream) {
      return;
    }

    const audioTrack = this.localStream.getAudioTracks()[0];
    if (!audioTrack) {
      return;
    }

    audioTrack.enabled = !audioTrack.enabled;
    useCallStore.getState().setMuted(!audioTrack.enabled);
  }

  async toggleVideo() {
    if (!this.localStream) {
      return;
    }

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (!videoTrack) {
      return;
    }

    videoTrack.enabled = !videoTrack.enabled;
    useCallStore.getState().setVideoEnabled(videoTrack.enabled);
  }

  async toggleSpeaker() {
    const nextBuiltInRoute: BuiltInAudioRoute =
      useCallStore.getState().preferredBuiltInRoute === "SPEAKER_PHONE" ? "EARPIECE" : "SPEAKER_PHONE";
    const activeCall = useCallStore.getState().activeCall;
    useCallStore.getState().setPreferredBuiltInRoute(nextBuiltInRoute);
    useCallStore.getState().setPreferredExternalRoute(null);
    if (this.audioSessionActive && activeCall) {
      this.startAudioSession(activeCall.mode, nextBuiltInRoute);
    }
  }

  async selectAudioRoute(route: AudioRoute) {
    const { activeCall, availableAudioRoutes } = useCallStore.getState();
    if (!activeCall) {
      return;
    }

    if (route === "SPEAKER_PHONE" || route === "EARPIECE") {
      useCallStore.getState().setPreferredBuiltInRoute(route);
      useCallStore.getState().setPreferredExternalRoute(null);
      if (this.audioSessionActive) {
        this.startAudioSession(activeCall.mode, route);
      } else {
        useCallStore.getState().setActiveAudioRoute(route);
      }
      return;
    }

    if ((route === "BLUETOOTH" || route === "WIRED_HEADSET") && availableAudioRoutes.includes(route)) {
      useCallStore.getState().setPreferredExternalRoute(route);
      if (this.audioSessionActive) {
        this.syncPreferredAudioRoute(route);
      } else {
        useCallStore.getState().setActiveAudioRoute(route);
      }
    }
  }

  switchCamera() {
    if (!this.localStream) {
      return;
    }

    const videoTrack = this.localStream.getVideoTracks()[0] as {
      enabled: boolean;
      _switchCamera?: () => void;
    };

    videoTrack?._switchCamera?.();
    const current = useCallStore.getState().cameraFacing;
    useCallStore.getState().setCameraFacing(current === "front" ? "back" : "front");
  }

  async reset() {
    InCallManager.stopRingtone();
    InCallManager.stopRingback();
    this.peerConnection?.close();
    this.peerConnection = null;
    this.remoteStream = null;
    this.clearAudioRouteSyncs();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    this.stopAudioSession();
    useCallStore.getState().reset();
    this.navigateAwayFromCallScreen();
  }

  private async prepareLocalMedia(mode: CallMode) {
    if (this.localStream) {
      return;
    }

    await this.ensureBluetoothPermission();

    this.localStream = await mediaDevices.getUserMedia({
      audio: true,
      video: mode === "video" ? {
        facingMode: useCallStore.getState().cameraFacing === "back" ? "environment" : "user",
        frameRate: {
          min: 10,
          ideal: 15,
          max: 20,
        },
        width: {
          min: 320,
          ideal: 640,
          max: 960,
        },
        height: {
          min: 180,
          ideal: 360,
          max: 540,
        },
      } : false,
    });

    this.startAudioSession(mode, useCallStore.getState().preferredBuiltInRoute);
    useCallStore.getState().setLocalStreamUrl(this.localStream.toURL());
    useCallStore.getState().setVideoEnabled(mode === "video");
  }

  private async createPeerConnection(activeCall: CallSession, createOffer: boolean) {
    const socket = socketService.getSocket();
    if (!socket) {
      return;
    }

    this.peerConnection = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
    });
    const peerConnection = this.peerConnection as RTCPeerConnection & {
      onicecandidate: ((event: { candidate: RTCIceCandidate | null }) => void) | null;
      ontrack: ((event: { streams: MediaStream[] }) => void) | null;
      onconnectionstatechange: (() => void) | null;
      oniceconnectionstatechange: (() => void) | null;
    };

    this.localStream?.getTracks().forEach((track) => {
      this.peerConnection?.addTrack(track, this.localStream as MediaStream);
    });

    this.optimizeSendersForLowBandwidth(activeCall.mode);

    peerConnection.onicecandidate = (event: { candidate: RTCIceCandidate | null }) => {
      if (!event.candidate) {
        return;
      }

      socket.emit("webrtc:ice-candidate", {
        callId: activeCall.callId,
        toUserId: activeCall.remoteUserId,
        candidate: event.candidate,
      });
    };

    peerConnection.ontrack = (event: { streams: MediaStream[] }) => {
      const [stream] = event.streams;
      if (!stream) {
        return;
      }

      this.remoteStream = stream;
      useCallStore.getState().setRemoteStreamUrl(stream.toURL());
      if (this.localStream) {
        useCallStore.getState().setLocalStreamUrl(this.localStream.toURL());
      }
      this.setCallStatus("connected");
      this.startAudioSession(activeCall.mode, useCallStore.getState().preferredBuiltInRoute);
    };

    peerConnection.onconnectionstatechange = () => {
      const connectionState = (this.peerConnection as RTCPeerConnection & {
        connectionState?: string;
      })?.connectionState;

      if (connectionState === "connected") {
        this.setCallStatus("connected");
        return;
      }

      if (connectionState === "failed" || connectionState === "disconnected") {
        useCallStore.getState().setErrorMessage("Call connection dropped.");
        void this.reset();
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      const iceConnectionState = (this.peerConnection as RTCPeerConnection & {
        iceConnectionState?: string;
      })?.iceConnectionState;

      if (iceConnectionState === "connected" || iceConnectionState === "completed") {
        this.setCallStatus("connected");
      } else if (iceConnectionState === "checking" || iceConnectionState === "new") {
        this.setCallStatus("connecting");
      } else if (iceConnectionState === "failed" || iceConnectionState === "disconnected") {
        useCallStore.getState().setErrorMessage("Call connection dropped.");
      }
    };

    if (createOffer) {
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: activeCall.mode === "video",
      });

      await this.peerConnection.setLocalDescription(offer);
      const identity = await this.buildLocalIdentityProof(activeCall.callId, offer.sdp ?? "");
      if (!identity) {
        return;
      }
      socket.emit("webrtc:offer", {
        callId: activeCall.callId,
        toUserId: activeCall.remoteUserId,
        sdp: offer,
        identity,
      });
    }
  }

  private async buildLocalIdentityProof(callId: string, sdp: string) {
    try {
      const localUser = useAuthStore.getState().user;
      if (!localUser || !sdp) {
        throw new Error("You must be signed in with a valid call description to build a device proof.");
      }

      return await buildCallIdentityProof(localUser.id, callId, sdp);
    } catch (error) {
      await this.handleSecurityFailure(
        error instanceof Error ? error.message : "The app could not sign this call securely.",
      );
      return null;
    }
  }

  private async verifyRemoteIdentity(input: {
    callId: string;
    remoteUserId: string;
    sdp: { sdp?: string } | undefined;
    identity?: CallIdentityProof;
  }) {
    const localUser = useAuthStore.getState().user;
    const activeCall = useCallStore.getState().activeCall;

    if (!localUser || !activeCall || !input.sdp?.sdp) {
      await this.handleSecurityFailure("The call security check could not run correctly.");
      return false;
    }

    try {
      const result = await verifyRemoteCallIdentity({
        localUserId: localUser.id,
        remoteUserId: input.remoteUserId,
        callId: input.callId,
        sdp: input.sdp.sdp,
        proof: input.identity ?? null,
      });

      useCallStore.getState().setEncryptionStatus(result.status);
      if (result.status !== "verified") {
        await this.handleSecurityFailure(result.reason ?? "The device identity check failed.");
        return false;
      }

      useCallStore.getState().setErrorMessage(null);
      return true;
    } catch (error) {
      await this.handleSecurityFailure(
        error instanceof Error ? error.message : "The device identity check failed.",
      );
      return false;
    }
  }

  private async handleSecurityFailure(message: string) {
    const activeCall = useCallStore.getState().activeCall;
    const socket = socketService.getSocket();

    useCallStore.getState().setEncryptionStatus("unverified");
    useCallStore.getState().setErrorMessage(message);

    if (activeCall && socket) {
      socket.emit(activeCall.direction === "incoming" ? "call:decline" : "call:end", {
        callId: activeCall.callId,
      });
    }

    Alert.alert("Security check failed", message);
    await this.reset();
  }

  private startAudioSession(callMode: CallMode, preferredBuiltInRoute: BuiltInAudioRoute) {
    const desiredMedia = this.resolveAudioSessionMedia(callMode, preferredBuiltInRoute);

    if (this.audioSessionActive && this.audioSessionMedia === desiredMedia) {
      this.syncPreferredAudioRoute();
      return;
    }

    if (this.audioSessionActive) {
      this.stopAudioSession();
    }

    // Android 10 relies strictly on auto=true to establish the background Telecom modes securely before WebRTC triggers.
    InCallManager.start({ media: desiredMedia, auto: true });
    this.audioSessionActive = true;
    this.audioSessionMedia = desiredMedia;

    this.syncPreferredAudioRoute();
  }

  private stopAudioSession() {
    if (!this.audioSessionActive) {
      return;
    }

    this.clearAudioRouteSyncs();
    InCallManager.stop();
    this.audioSessionActive = false;
    this.audioSessionMedia = null;
  }

  private resolveAudioSessionMedia(callMode: CallMode, preferredBuiltInRoute: BuiltInAudioRoute): CallMode {
    if (callMode === "video") {
      return "video";
    }

    return preferredBuiltInRoute === "SPEAKER_PHONE" ? "video" : "audio";
  }

  private getDesiredAudioRoute(availableRoutes = useCallStore.getState().availableAudioRoutes): AudioRoute {
    const { preferredBuiltInRoute, preferredExternalRoute } = useCallStore.getState();

    if (preferredExternalRoute && availableRoutes.includes(preferredExternalRoute)) {
      return preferredExternalRoute;
    }

    if (preferredBuiltInRoute === "EARPIECE" && availableRoutes.includes("EARPIECE")) {
      return "EARPIECE";
    }

    return "SPEAKER_PHONE";
  }

  private applyDefaultAudioPreferences(mode: CallMode) {
    const builtInRoute = mode === "video" ? "SPEAKER_PHONE" : "EARPIECE";
    useCallStore.getState().setPreferredBuiltInRoute(builtInRoute);
    useCallStore.getState().setPreferredExternalRoute(null);
    useCallStore.getState().setActiveAudioRoute(builtInRoute);
  }

  private applyAudioRoute(route: AudioRoute) {
    switch (route) {
      case "SPEAKER_PHONE":
        InCallManager.setForceSpeakerphoneOn(true);
        InCallManager.setSpeakerphoneOn(true);
        void InCallManager.chooseAudioRoute("SPEAKER_PHONE");
        break;
      case "BLUETOOTH":
        void InCallManager.requestAudioFocus();
        void InCallManager.chooseAudioRoute("BLUETOOTH");
        break;
      case "WIRED_HEADSET":
        void InCallManager.requestAudioFocus();
        void InCallManager.chooseAudioRoute("WIRED_HEADSET");
        break;
      case "EARPIECE":
      default:
        InCallManager.setForceSpeakerphoneOn(false);
        InCallManager.setSpeakerphoneOn(false);
        void InCallManager.chooseAudioRoute("EARPIECE");
        break;
    }

    useCallStore.getState().setActiveAudioRoute(route);
  }

  private syncPreferredAudioRoute(routeOverride?: AudioRoute) {
    this.clearAudioRouteSyncs();
    if (!this.audioSessionActive) {
      return;
    }

    const { activeCall } = useCallStore.getState();
    if (!activeCall) {
      return;
    }

    const preferredRoute = routeOverride ?? this.getDesiredAudioRoute();

    ANDROID_AUDIO_ROUTE_SYNC_DELAYS.forEach((delay) => {
      const timeout = setTimeout(() => {
        if (!this.audioSessionActive) {
          return;
        }

        this.applyAudioRoute(preferredRoute);
      }, delay);
      this.audioRouteSyncTimeouts.push(timeout);
    });
  }

  private clearAudioRouteSyncs() {
    this.audioRouteSyncTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.audioRouteSyncTimeouts = [];
  }

  private attachAudioRouteListener() {
    if (Platform.OS !== "android" || this.routeChangeSubscription) {
      return;
    }

    this.routeChangeSubscription = DeviceEventEmitter.addListener("onAudioDeviceChanged", (event: {
      availableAudioDeviceList?: string;
      selectedAudioDevice?: string;
      bluetoothDeviceName?: string;
    }) => {
      const selectedRoute = this.parseAudioRoute(event.selectedAudioDevice);
      const availableRoutes = this.parseAvailableRoutes(event.availableAudioDeviceList);
      const bluetoothDeviceName = event.bluetoothDeviceName?.trim() || null;
      const { activeCall, preferredExternalRoute } = useCallStore.getState();

      useCallStore.getState().setAvailableAudioRoutes(availableRoutes);
      useCallStore.getState().setActiveAudioRoute(selectedRoute);
      useCallStore.getState().setBluetoothDeviceName(bluetoothDeviceName);

      if (preferredExternalRoute && !availableRoutes.includes(preferredExternalRoute)) {
        useCallStore.getState().setPreferredExternalRoute(null);
      }

      if (!this.audioSessionActive || !activeCall) {
        return;
      }

      const preferredRoute = this.getDesiredAudioRoute(availableRoutes);
      if (selectedRoute !== preferredRoute) {
        this.syncPreferredAudioRoute(preferredRoute);
      }
    });
  }

  private detachAudioRouteListener() {
    this.routeChangeSubscription?.remove();
    this.routeChangeSubscription = null;
  }

  private parseAvailableRoutes(rawRoutes?: string) {
    if (!rawRoutes) {
      return [];
    }

    try {
      const parsed = JSON.parse(rawRoutes);
      return Array.isArray(parsed)
        ? parsed
            .map((route) => this.parseAudioRoute(route))
            .filter((route): route is AudioRoute => route !== "NONE")
        : [];
    } catch {
      return [];
    }
  }

  private parseAudioRoute(route?: string): AudioRoute {
    switch (route) {
      case "SPEAKER_PHONE":
      case "EARPIECE":
      case "WIRED_HEADSET":
      case "BLUETOOTH":
        return route;
      default:
        return "NONE";
    }
  }

  private optimizeSendersForLowBandwidth(mode: CallMode) {
    if (!this.peerConnection) {
      return;
    }

    this.peerConnection.getSenders().forEach((sender) => {
      const track = sender.track;
      if (!track) {
        return;
      }

      if (track.kind === "audio") {
        const parameters = sender.getParameters() as any;

        void (sender as any).setParameters({
          ...parameters,
          encodings: [
            {
              ...(parameters.encodings?.[0] ?? {}),
              active: true,
              maxBitrate: 48_000,
            },
          ],
        }).catch(() => undefined);
        return;
      }

      if (track.kind === "video" && mode === "video") {
        const parameters = sender.getParameters() as any;
        const encoding = parameters.encodings?.[0] ?? {};

        void (sender as any).setParameters({
          ...parameters,
          degradationPreference: "maintain-framerate",
          encodings: [
            {
              ...encoding,
              active: true,
              maxBitrate: 350_000,
              maxFramerate: 15,
              scaleResolutionDownBy: 1,
            },
          ],
        }).catch(() => undefined);
      }
    });
  }

  private setCallStatus(status: "ringing" | "incoming" | "connecting" | "connected" | "ended" | "error" | "idle") {
    const currentStatus = useCallStore.getState().status;
    if (
      currentStatus === "connected" &&
      (status === "incoming" || status === "ringing" || status === "connecting")
    ) {
      return;
    }

    useCallStore.getState().setStatus(status);
  }

  private async ensureBluetoothPermission() {
    if (Platform.OS !== "android" || Number(Platform.Version) < 31) {
      return;
    }

    const bluetoothPermission = PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT;
    if (!bluetoothPermission) {
      return;
    }

    const hasPermission = await PermissionsAndroid.check(bluetoothPermission);
    if (hasPermission) {
      return;
    }

    await PermissionsAndroid.request(bluetoothPermission);
  }

  private waitForSocket(timeoutMs = 8000) {
    const currentSocket = socketService.getSocket();
    if (currentSocket?.connected) {
      return Promise.resolve(currentSocket);
    }

    return new Promise<ReturnType<typeof socketService.getSocket>>((resolve) => {
      let socket = socketService.getSocket();
      const cleanup = () => {
        clearTimeout(timeout);
        clearInterval(interval);
        socket?.off("connect", handleConnect);
      };
      const handleConnect = () => {
        cleanup();
        resolve(socket);
      };
      const attachConnectListener = () => {
        socket?.off("connect", handleConnect);
        socket = socketService.getSocket();
        if (socket?.connected) {
          cleanup();
          resolve(socket);
          return;
        }

        socket?.once("connect", handleConnect);
      };
      const interval = setInterval(attachConnectListener, 250);
      const timeout = setTimeout(() => {
        cleanup();
        const finalSocket = socketService.getSocket();
        resolve(finalSocket?.connected ? finalSocket : null);
      }, timeoutMs);

      attachConnectListener();
    });
  }

  private navigateAwayFromCallScreen() {
    if (!navigationRef.isReady() || navigationRef.getCurrentRoute()?.name !== "Call") {
      return;
    }

    if (navigationRef.canGoBack()) {
      navigationRef.goBack();
      return;
    }

    navigationRef.navigate("Home");
  }
}

export const callManager = new CallManager();
