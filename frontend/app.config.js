module.exports = () => {
  const owner = process.env.EXPO_OWNER?.trim();
  const projectId = process.env.EXPO_EAS_PROJECT_ID?.trim() || "32ec2433-1d5a-4dd6-aaf6-a739579030e4";
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim() || "https://peer-2-peer-video-call.onrender.com";

  const extra = {
    apiBaseUrl,
  };
  const eas = {};

  if (projectId) {
    eas.projectId = projectId;
  } else {
    delete eas.projectId;
  }

  if (Object.keys(eas).length > 0) {
    extra.eas = eas;
  } else {
    delete extra.eas;
  }

  return {
    name: "Callie",
    slug: "callie-mobile",
    scheme: "callie",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    plugins: [
      [
        "expo-notifications",
        {
          defaultChannel: "calls",
        },
      ],
      "./plugins/withAndroidSpeakerRouteFix",
      "expo-secure-store",
      "expo-font",
    ],
    android: {
      package: "com.callie.mobile",
      permissions: [
        "CAMERA",
        "RECORD_AUDIO",
        "POST_NOTIFICATIONS",
        "android.permission.BLUETOOTH",
        "android.permission.BLUETOOTH_ADMIN",
        "android.permission.BLUETOOTH_CONNECT",
        "android.permission.USE_FULL_SCREEN_INTENT",
        "android.permission.WAKE_LOCK",
        "android.permission.VIBRATE",
      ],
    },
    ios: {
      bundleIdentifier: "com.callie.mobile",
      infoPlist: {
        NSCameraUsageDescription: "Callie uses the camera for secure video calls.",
        NSMicrophoneUsageDescription: "Callie uses the microphone for secure audio and video calls.",
      },
    },
    extra,
    owner: owner || "pallabinfo",
  };
};
