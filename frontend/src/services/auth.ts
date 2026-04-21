import { apiRequest } from "../api/client";
import type { User } from "../types/app";

export const authApi = {
  register: async (payload: { firstName: string; lastName?: string; email: string; password: string; }) => {
    return apiRequest<User>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
      auth: false,
    });
  },
  login: async (payload: { email: string; password: string; }) => {
    return apiRequest<{ token: string; user: User; }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
      auth: false,
    });
  },
  me: async () => {
    return apiRequest<User>("/api/auth/me");
  },
  verifyEmail: async (token: string) => {
    return apiRequest<null>("/api/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
      auth: false,
    });
  },
  resendVerification: async (email: string) => {
    return apiRequest<null>("/api/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
      auth: false,
    });
  },
  forgotPassword: async (email: string) => {
    return apiRequest<null>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
      auth: false,
    });
  },
  resetPassword: async (token: string, password: string) => {
    return apiRequest<null>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
      auth: false,
    });
  },
};
