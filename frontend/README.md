# Callie Mobile

This Expo app uses native modules like `react-native-webrtc`, so it should be opened with a development build, not Expo Go.

## Run on phone

1. Install the Android dev build on your phone once:
   `npm run android`
2. Start Metro with a phone-friendly URL:
   `npm run start`

`npm run start` now uses Expo tunnel mode by default, which works better when your phone is connected through a hotspot or cannot reach your laptop over LAN.

## Extra start modes

- `npm run start`: dev client + tunnel
- `npm run start:lan`: dev client + same-network LAN
- `npm run start:local`: emulator/local machine only

If the QR opens Expo Go, it will not load this app correctly. Open it with the installed Callie development build instead.
