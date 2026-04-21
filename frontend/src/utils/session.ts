let accessToken: string | null = null;

export const sessionToken = {
  get() {
    return accessToken;
  },
  set(token: string | null) {
    accessToken = token;
  },
};
