import { createNavigationContainerRef } from "@react-navigation/native";

export type RootStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token: string; } | undefined;
  VerifyEmail: undefined;
  AccessDenied: undefined;
  Home: undefined;
  Admin: undefined;
  Call: undefined;
};

export const navigationRef = createNavigationContainerRef<RootStackParamList>();
