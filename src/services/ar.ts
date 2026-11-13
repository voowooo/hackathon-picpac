import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

// Настоящий AR (ARKit на iOS / ARCore на Android) через @stewmore/expo-ar.
// Работает только в dev-сборке: в Expo Go нативного модуля нет, require
// или getCapabilities упадёт — тогда доступна примерка камерой с приближённой
// компенсацией поворотов по гироскопу. Она не отслеживает перенос телефона.
export let ExpoAr: typeof import("@stewmore/expo-ar") | null = null;

try {
  if (Platform.OS !== 'web' && requireOptionalNativeModule('ExpoAr')) {
    ExpoAr = require("@stewmore/expo-ar");
  }
} catch { }

export let arCapabilities: { arSupported: boolean } | null = null;

try {
  arCapabilities = ExpoAr?.getCapabilities() ?? null;
} catch {
  arCapabilities = null;
}

