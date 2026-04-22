const fs = require("fs");
const path = require("path");
const { withDangerousMod, createRunOncePlugin } = require("@expo/config-plugins");

const PKG = "with-android-speaker-route-fix";
const VERSION = "1.0.0";

const importNeedle = 'import java.util.List;';

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

const helperMethod = `    private boolean setCommunicationDevice(int targetDeviceType) {
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
  }

  fs.writeFileSync(targetFile, source);
}

const withAndroidSpeakerRouteFix = (config) =>
  withDangerousMod(config, [
    "android",
    async (modConfig) => {
      patchInCallManager(modConfig.modRequest.projectRoot);
      return modConfig;
    },
  ]);

module.exports = createRunOncePlugin(withAndroidSpeakerRouteFix, PKG, VERSION);
