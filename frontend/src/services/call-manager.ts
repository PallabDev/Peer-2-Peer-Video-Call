import { mediaDevices, RTCPeerConnection, RTCIceCandidate, RTCSessionDescription } from "react-native-webrtc";
import type { MediaStream } from "react-native-webrtc";
import InCallManager from "react-native-incall-manager";
import { DeviceEventEmitter, type EmitterSubscription, PermissionsAndroid, Platform } from "react-native";
import { socketService } from "./socket";
import { useCallStore } from "../store/call-store";
import type { AudioRoute, BuiltInAudioRoute, CallMode, CallSession, Contact } from "../types/app";
import { playIncomingCallNotification } from "./push-notifications";
import { navigationRef } from "../navigation/navigationRef";

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

  attachSocket() {
    const socket = socketService.getSocket();
    if (!socket || this.listenersAttached) {
      return;
    }

    this.listenersAttached = true;
    this.attachAudioRouteListener();

    socket.on("call:incoming", async (payload: { callId: string; callerId: string; callerName?: string; mode: CallMode; }) => {
      const incomingCall: CallSession = {
        callId: payload.callId,
        remoteUserId: payload.callerId,
        remoteUserName: payload.callerName ?? "Unknown caller",
        mode: payload.mode,
        direction: "incoming",
      };

      useCallStore.getState().setIncomingCall(incomingCall);
      InCallManager.startRingtone("_DEFAULT_", [0, 250, 250, 250], "playback", 30);
      await playIncomingCallNotification(incomingCall.remoteUserName, incomingCall.mode);
    });

    socket.on("call:accepted", async (payload: { callId: string; }) => {
      const state = useCallStore.getState();
      if (!state.activeCall || state.activeCall.callId !== payload.callId) {
        return;
      }

      InCallManager.stopRingback();
      await this.prepareLocalMedia(state.activeCall.mode);
      await this.createPeerConnection(state.activeCall, true);
      useCallStore.getState().setStatus("connecting");
    });

    socket.on("call:declined", async () => {
      useCallStore.getState().setErrorMessage("Call declined");
      await this.reset();
    });

    socket.on("call:missed", async () => {
      useCallStore.getState().setErrorMessage("Call timed out");
      await this.reset();
    });

    socket.on("call:cancelled", async () => {
      await this.reset();
    });

    socket.on("call:ended", async () => {
      await this.reset();
    });

    socket.on("webrtc:offer", async (payload: { callId: string; fromUserId: string; sdp: any; }) => {
      const activeCall = useCallStore.getState().activeCall;
      if (!activeCall || activeCall.callId !== payload.callId) {
        return;
      }

      if (!this.peerConnection) {
        await this.prepareLocalMedia(activeCall.mode);
        await this.createPeerConnection(activeCall, false);
      }

      await this.peerConnection?.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      const answer = await this.peerConnection?.createAnswer();
      if (!answer) {
        return;
      }

      await this.peerConnection?.setLocalDescription(answer);
      socket.emit("webrtc:answer", {
        callId: activeCall.callId,
        toUserId: payload.fromUserId,
        sdp: answer,
      });
      useCallStore.getState().setStatus("connecting");
    });

    socket.on("webrtc:answer", async (payload: { callId: string; sdp: any; }) => {
      const activeCall = useCallStore.getState().activeCall;
      if (!activeCall || activeCall.callId !== payload.callId) {
        return;
      }

      await this.peerConnection?.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      useCallStore.getState().setStatus("connected");
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
    const socket = socketService.getSocket();
    if (!socket) {
      throw new Error("Socket is not connected");
    }

    const response = await new Promise<{ success: boolean; callId?: string; message?: string; }>((resolve) => {
      socket.emit("call:initiate", {
        toUserId: contact.id,
        mode,
      }, resolve);
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
    useCallStore.getState().setStatus("ringing");
    useCallStore.getState().setPreferredBuiltInRoute(mode === "video" ? "SPEAKER_PHONE" : "EARPIECE");
    useCallStore.getState().setPreferredExternalRoute(null);
    useCallStore.getState().setActiveAudioRoute(mode === "video" ? "SPEAKER_PHONE" : "EARPIECE");
    InCallManager.startRingback("_DEFAULT_");
    return activeCall;
  }

  async acceptIncomingCall() {
    const incomingCall = useCallStore.getState().incomingCall;
    const socket = socketService.getSocket();
    if (!incomingCall || !socket) {
      return;
    }

    InCallManager.stopRingtone();
    useCallStore.getState().setActiveCall(incomingCall);
    useCallStore.getState().setIncomingCall(null);
    useCallStore.getState().setStatus("connecting");
    useCallStore.getState().setPreferredBuiltInRoute(incomingCall.mode === "video" ? "SPEAKER_PHONE" : "EARPIECE");
    useCallStore.getState().setPreferredExternalRoute(null);
    useCallStore.getState().setActiveAudioRoute(incomingCall.mode === "video" ? "SPEAKER_PHONE" : "EARPIECE");
    await this.prepareLocalMedia(incomingCall.mode);
    await this.createPeerConnection(incomingCall, false);
    socket.emit("call:accept", { callId: incomingCall.callId });
  }

  async declineIncomingCall() {
    const incomingCall = useCallStore.getState().incomingCall;
    const socket = socketService.getSocket();
    if (!incomingCall || !socket) {
      return;
    }

    InCallManager.stopRingtone();
    socket.emit("call:decline", { callId: incomingCall.callId });
    useCallStore.getState().setIncomingCall(null);
  }

  async endCurrentCall() {
    const activeCall = useCallStore.getState().activeCall;
    const socket = socketService.getSocket();
    if (activeCall && socket) {
      socket.emit("call:end", { callId: activeCall.callId });
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
        facingMode: "user",
        frameRate: 30,
        width: 1280,
        height: 720,
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
    };

    this.localStream?.getTracks().forEach((track) => {
      this.peerConnection?.addTrack(track, this.localStream as MediaStream);
    });

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
      useCallStore.getState().setStatus("connected");
      this.startAudioSession(activeCall.mode, useCallStore.getState().preferredBuiltInRoute);
    };

    if (createOffer) {
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: activeCall.mode === "video",
      });

      await this.peerConnection.setLocalDescription(offer);
      socket.emit("webrtc:offer", {
        callId: activeCall.callId,
        toUserId: activeCall.remoteUserId,
        sdp: offer,
      });
    }
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

  private applyAudioRoute(route: AudioRoute) {
    switch (route) {
      case "SPEAKER_PHONE":
        InCallManager.setForceSpeakerphoneOn(true);
        InCallManager.setSpeakerphoneOn(true);
        void InCallManager.chooseAudioRoute("SPEAKER_PHONE");
        break;
      case "BLUETOOTH":
        InCallManager.setForceSpeakerphoneOn(false);
        void InCallManager.chooseAudioRoute("BLUETOOTH");
        break;
      case "WIRED_HEADSET":
        InCallManager.setForceSpeakerphoneOn(false);
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
