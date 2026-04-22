import Constants from "expo-constants";
import type { ApiEnvelope } from "../types/app";
import { sessionToken } from "../utils/session";

const DEFAULT_PRODUCTION_API_URL = "https://peer-2-peer-video-call.onrender.com";

const getBaseUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    return envUrl;
  }

  const expoConfig = (Constants as {
    expoConfig?: {
      hostUri?: string;
      extra?: {
        apiBaseUrl?: string;
      };
    };
  }).expoConfig;

  const hostUri = expoConfig?.hostUri?.split(":")[0];
  if (hostUri) {
    return `http://${hostUri}:8080`;
  }

  return expoConfig?.extra?.apiBaseUrl ?? DEFAULT_PRODUCTION_API_URL;
};

export const API_BASE_URL = getBaseUrl();

type RequestOptions = RequestInit & {
  auth?: boolean;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<ApiEnvelope<T>> {
  const token = sessionToken.get();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (options.auth !== false && token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message ?? "Request failed");
  }

  return payload as ApiEnvelope<T>;
}
