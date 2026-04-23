const fs = require("fs");
const path = require("path");
const { AndroidConfig, withAndroidManifest, withDangerousMod, createRunOncePlugin } = require("@expo/config-plugins");

const PKG = "with-android-speaker-route-fix";
const VERSION = "1.2.0";

const importNeedle = 'import java.util.List;';
const bluetoothManagerGetterNeedle = `  /** Converts BluetoothAdapter states into local string representations. */`;
const bluetoothManagerGetterMethod = `  @Nullable
  @SuppressLint("MissingPermission")
  public String getSelectedDeviceName() {
    if (bluetoothDevice != null && bluetoothDevice.getName() != null && !bluetoothDevice.getName().isEmpty()) {
      return bluetoothDevice.getName();
    }

    if (bluetoothHeadset != null) {
      List<BluetoothDevice> devices = getFinalConnectedDevices();
      if (!devices.isEmpty()) {
        bluetoothDevice = devices.get(0);
        if (bluetoothDevice.getName() != null && !bluetoothDevice.getName().isEmpty()) {
          return bluetoothDevice.getName();
        }
      }
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && bluetoothAudioDevice != null && bluetoothAudioDevice.getProductName() != null) {
      return bluetoothAudioDevice.getProductName().toString();
    }

    return null;
  }

  /** Converts BluetoothAdapter states into local string representations. */`;

const originalMethod = `    @ReactMethod
    public void setSpeakerphoneOn(final boolean enable) {
        if (enable != audioManager.isSpeakerphoneOn())  {
            Log.d(TAG, "setSpeakerphoneOn(): " + enable);
\t    audioManager.setMode(defaultAudioMode);
            audioManager.setSpeakerphoneOn(enable);
        }
    }
`;

const patchedMethod = `    @ReactMethod
    public void setSpeakerphoneOn(final boolean enable) {
        Log.d(TAG, "setSpeakerphoneOn(): " + enable);
        audioManager.setMode(defaultAudioMode);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            final int targetDeviceType = enable
                    ? AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
                    : AudioDeviceInfo.TYPE_BUILTIN_EARPIECE;
            final boolean didRoute = setCommunicationDevice(targetDeviceType);

            if (!didRoute && !enable) {
                audioManager.clearCommunicationDevice();
            }
        }

        audioManager.setSpeakerphoneOn(enable);
    }
`;

const helperNeedle = `    /** Gets the current earpiece state. */`;
const audioStatusNeedle = `        data.putString("availableAudioDeviceList", audioDevicesJson);
        data.putString("selectedAudioDevice", (selectedAudioDevice == null) ? "" : selectedAudioDevice.name());

        return data;`;
const patchedAudioStatus = `        data.putString("availableAudioDeviceList", audioDevicesJson);
        data.putString("selectedAudioDevice", (selectedAudioDevice == null) ? "" : selectedAudioDevice.name());

        String bluetoothDeviceName = bluetoothManager != null ? bluetoothManager.getSelectedDeviceName() : null;
        data.putString("bluetoothDeviceName", bluetoothDeviceName == null ? "" : bluetoothDeviceName);

        return data;`;

const setAudioDeviceInternalNeedle = `            case WIRED_HEADSET:
                setSpeakerphoneOn(false);
                break;
            case BLUETOOTH:
                setSpeakerphoneOn(false);
                break;`;
const patchedSetAudioDeviceInternal = `            case WIRED_HEADSET:
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                        && setCommunicationDevice(
                            AudioDeviceInfo.TYPE_WIRED_HEADSET,
                            AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
                            AudioDeviceInfo.TYPE_USB_HEADSET,
                            AudioDeviceInfo.TYPE_USB_DEVICE
                        )) {
                    break;
                }
                audioManager.setSpeakerphoneOn(false);
                break;
            case BLUETOOTH:
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                        && setCommunicationDevice(
                            AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
                            AudioDeviceInfo.TYPE_BLE_HEADSET,
                            AudioDeviceInfo.TYPE_BLE_SPEAKER
                        )) {
                    break;
                }
                audioManager.setMode(defaultAudioMode);
                audioManager.setSpeakerphoneOn(false);
                break;`;

const helperMethod = `    private boolean setCommunicationDevice(int... targetDeviceTypes) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return false;
        }

        List<AudioDeviceInfo> devices = audioManager.getAvailableCommunicationDevices();
        for (int targetDeviceType : targetDeviceTypes) {
            for (AudioDeviceInfo device : devices) {
                if (device.getType() == targetDeviceType) {
                    boolean didSet = audioManager.setCommunicationDevice(device);
                    Log.d(TAG, "setCommunicationDevice(): type=" + targetDeviceType + ", success=" + didSet);
                    return didSet;
                }
            }
        }

        Log.d(TAG, "setCommunicationDevice(): target device not available");
        return false;
    }

    /** Gets the current earpiece state. */`;

const oldHelperSignature = "private boolean setCommunicationDevice(int targetDeviceType)";
const oldHelperBodyNeedle = `    private boolean setCommunicationDevice(int targetDeviceType) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return false;
        }

        List<AudioDeviceInfo> devices = audioManager.getAvailableCommunicationDevices();
        for (AudioDeviceInfo device : devices) {
            if (device.getType() == targetDeviceType) {
                boolean didSet = audioManager.setCommunicationDevice(device);
                Log.d(TAG, "setCommunicationDevice(): type=" + targetDeviceType + ", success=" + didSet);
                return didSet;
            }
        }

        Log.d(TAG, "setCommunicationDevice(): target device not available: " + targetDeviceType);
        return false;
    }

    /** Gets the current earpiece state. */`;

const expoNotificationBuilderImportsNeedle = `import android.content.Context
import android.content.pm.PackageManager`;
const patchedExpoNotificationBuilderImports = `import android.content.Context
import android.content.pm.PackageManager
import androidx.core.app.NotificationCompat`;
const expoNotificationBuilderContentIntentNeedle = `    builder.setContentIntent(
      createNotificationResponseIntent(
        context,
        notification,
        defaultAction
      )
    )`;
const patchedExpoNotificationBuilderContentIntent = `    val contentIntent = createNotificationResponseIntent(
      context,
      notification,
      defaultAction
    )
    builder.setContentIntent(contentIntent)

    if (notificationContent.categoryId == "incoming_call") {
      builder.setCategory(NotificationCompat.CATEGORY_CALL)
      builder.setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      builder.setFullScreenIntent(contentIntent, true)
    }`;

function patchBluetoothManager(projectRoot) {
  const targetFile = path.join(
    projectRoot,
    "node_modules",
    "react-native-incall-manager",
    "android",
    "src",
    "main",
    "java",
    "com",
    "zxcpoiu",
    "incallmanager",
    "AppRTC",
    "AppRTCBluetoothManager.java"
  );

  if (!fs.existsSync(targetFile)) {
    throw new Error(`Could not find AppRTCBluetoothManager.java at ${targetFile}`);
  }

  let source = fs.readFileSync(targetFile, "utf8");

  if (!source.includes("public String getSelectedDeviceName()")) {
    source = source.replace(bluetoothManagerGetterNeedle, bluetoothManagerGetterMethod);
  }

  fs.writeFileSync(targetFile, source);
}

function patchInCallManager(projectRoot) {
  const targetFile = path.join(
    projectRoot,
    "node_modules",
    "react-native-incall-manager",
    "android",
    "src",
    "main",
    "java",
    "com",
    "zxcpoiu",
    "incallmanager",
    "InCallManagerModule.java"
  );

  if (!fs.existsSync(targetFile)) {
    throw new Error(`Could not find InCallManagerModule.java at ${targetFile}`);
  }

  let source = fs.readFileSync(targetFile, "utf8");

  if (!source.includes(importNeedle)) {
    source = source.replace("import java.util.HashSet;\n", `import java.util.HashSet;\n${importNeedle}\n`);
  }

  if (source.includes(originalMethod)) {
    source = source.replace(originalMethod, patchedMethod);
  }

  if (!source.includes("private boolean setCommunicationDevice(int targetDeviceType)")) {
    source = source.replace(helperNeedle, helperMethod);
  } else if (source.includes(oldHelperBodyNeedle)) {
    source = source.replace(oldHelperBodyNeedle, helperMethod);
  } else if (source.includes(oldHelperSignature)) {
    source = source.replace(oldHelperSignature, "private boolean setCommunicationDevice(int... targetDeviceTypes)");
  }

  if (source.includes(audioStatusNeedle)) {
    source = source.replace(audioStatusNeedle, patchedAudioStatus);
  }

  if (source.includes(setAudioDeviceInternalNeedle)) {
    source = source.replace(setAudioDeviceInternalNeedle, patchedSetAudioDeviceInternal);
  }

  fs.writeFileSync(targetFile, source);
}

function patchExpoNotifications(projectRoot) {
  const targetFile = path.join(
    projectRoot,
    "node_modules",
    "expo-notifications",
    "android",
    "src",
    "main",
    "java",
    "expo",
    "modules",
    "notifications",
    "notifications",
    "presentation",
    "builders",
    "ExpoNotificationBuilder.kt"
  );

  if (!fs.existsSync(targetFile)) {
    throw new Error(`Could not find ExpoNotificationBuilder.kt at ${targetFile}`);
  }

  let source = fs.readFileSync(targetFile, "utf8");

  if (!source.includes("NotificationCompat.CATEGORY_CALL")) {
    if (!source.includes("import androidx.core.app.NotificationCompat")) {
      source = source.replace(expoNotificationBuilderImportsNeedle, patchedExpoNotificationBuilderImports);
    }

    source = source.replace(expoNotificationBuilderContentIntentNeedle, patchedExpoNotificationBuilderContentIntent);
  }

  fs.writeFileSync(targetFile, source);
}

const withAndroidCallPermissions = (config) =>
  withAndroidManifest(config, (modConfig) => {
    const permissions = [
      "android.permission.USE_FULL_SCREEN_INTENT",
      "android.permission.WAKE_LOCK",
      "android.permission.VIBRATE",
    ];

    permissions.forEach((permission) => {
      AndroidConfig.Permissions.addPermission(modConfig.modResults, permission);
    });

    return modConfig;
  });

const withAndroidSpeakerRouteFix = (config) => {
  const configWithPermissions = withAndroidCallPermissions(config);

  return withDangerousMod(configWithPermissions, [
    "android",
    async (modConfig) => {
      patchBluetoothManager(modConfig.modRequest.projectRoot);
      patchInCallManager(modConfig.modRequest.projectRoot);
      patchExpoNotifications(modConfig.modRequest.projectRoot);
      return modConfig;
    },
  ]);
};

module.exports = createRunOncePlugin(withAndroidSpeakerRouteFix, PKG, VERSION);
