import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "../api/client";

class SocketService {
  private socket: Socket | null = null;

  connect(token: string) {
    if (this.socket?.connected) {
      return this.socket;
    }

    if (this.socket && !this.socket.connected) {
      this.socket.auth = { token };
      this.socket.connect();
      return this.socket;
    }

    this.socket = io(API_BASE_URL, {
      transports: ["websocket"],
      auth: {
        token,
      },
    });

    return this.socket;
  }

  getSocket() {
    return this.socket;
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}

export const socketService = new SocketService();
