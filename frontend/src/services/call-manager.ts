import { mediaDevices, RTCPeerConnection, RTCIceCandidate, RTCSessionDescription } from "react-native-webrtc";
import type { MediaStream } from "react-native-webrtc";
import { socketService } from "./socket";
import { useCallStore } from "../store/call-store";
import type { CallMode, CallSession, Contact } from "../types/app";
import { playIncomingCallNotification } from "./push-notifications";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

class CallManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private listenersAttached = false;

  attachSocket() {
    const socket = socketService.getSocket();
    if (!socket || this.listenersAttached) {
      return;
    }

    this.listenersAttached = true;

    socket.on("call:incoming", async (payload: { callId: string; callerId: string; callerName?: string; mode: CallMode; }) => {
      const incomingCall: CallSession = {
        callId: payload.callId,
        remoteUserId: payload.callerId,
        remoteUserName: payload.callerName ?? "Unknown caller",
        mode: payload.mode,
        direction: "incoming",
      };

      useCallStore.getState().setIncomingCall(incomingCall);
      await playIncomingCallNotification(incomingCall.remoteUserName, incomingCall.mode);
    });

    socket.on("call:accepted", async (payload: { callId: string; }) => {
      const state = useCallStore.getState();
      if (!state.activeCall || state.activeCall.callId !== payload.callId) {
        return;
      }

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
    return activeCall;
  }

  async acceptIncomingCall() {
    const incomingCall = useCallStore.getState().incomingCall;
    const socket = socketService.getSocket();
    if (!incomingCall || !socket) {
      return;
    }

    useCallStore.getState().setActiveCall(incomingCall);
    useCallStore.getState().setIncomingCall(null);
    useCallStore.getState().setStatus("connecting");
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
    this.peerConnection?.close();
    this.peerConnection = null;
    this.remoteStream = null;

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    useCallStore.getState().reset();
  }

  private async prepareLocalMedia(mode: CallMode) {
    if (this.localStream) {
      return;
    }

    this.localStream = await mediaDevices.getUserMedia({
      audio: true,
      video: mode === "video" ? {
        facingMode: "user",
        frameRate: 30,
        width: 1280,
        height: 720,
      } : false,
    });

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

    this.localStream?.getTracks().forEach((track) => {
      this.peerConnection?.addTrack(track, this.localStream as MediaStream);
    });

    this.peerConnection.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      socket.emit("webrtc:ice-candidate", {
        callId: activeCall.callId,
        toUserId: activeCall.remoteUserId,
        candidate: event.candidate,
      });
    };

    this.peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) {
        return;
      }

      this.remoteStream = stream;
      useCallStore.getState().setRemoteStreamUrl(stream.toURL());
      useCallStore.getState().setStatus("connected");
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
}

export const callManager = new CallManager();
