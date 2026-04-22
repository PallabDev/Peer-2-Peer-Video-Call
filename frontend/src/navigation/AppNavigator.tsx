import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuthStore } from "../store/auth-store";
import { LoadingScreen } from "../screens/LoadingScreen";
import { SignInScreen } from "../screens/SignInScreen";
import { SignUpScreen } from "../screens/SignUpScreen";
import { ForgotPasswordScreen } from "../screens/ForgotPasswordScreen";
import { ResetPasswordScreen } from "../screens/ResetPasswordScreen";
import { VerifyEmailScreen } from "../screens/VerifyEmailScreen";
import { AccessDeniedScreen } from "../screens/AccessDeniedScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { AdminScreen } from "../screens/AdminScreen";
import { CallScreen } from "../screens/CallScreen";
import type { RootStackParamList } from "./navigationRef";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const { loading, user } = useAuthStore();

  if (loading) {
    return <LoadingScreen />;
  }

  const isLoggedIn = Boolean(user);
  const isVerified = Boolean(user?.emailVerified);
  const hasAppAccess = Boolean(user && (user.role === "admin" || user.accessStatus === "approved"));

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: "fade" }}>
      {!isLoggedIn ? (
        <>
          <Stack.Screen name="SignIn" component={SignInScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
        </>
      ) : !isVerified ? (
        <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      ) : !hasAppAccess ? (
        <Stack.Screen name="AccessDenied" component={AccessDeniedScreen} />
      ) : (
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Admin" component={AdminScreen} />
          <Stack.Screen name="Call" component={CallScreen} />
        </>
      )}
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
}
