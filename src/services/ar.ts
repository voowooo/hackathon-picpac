

// Настоящий AR (ARKit на iOS / ARCore на Android) через @stewmore/expo-ar.
// Работает только в dev-сборке: в Expo Go нативного модуля нет, require
// или getCapabilities упадёт — тогда используется запасной псевдо-AR
// на датчиках движения (PosterARView ниже, в Expo Go / на web).
export let ExpoAr: typeof import("@stewmore/expo-ar") | null = null;

try {
  ExpoAr = require("@stewmore/expo-ar");
} catch { }

export let arCapabilities: { arSupported: boolean } | null = null;

try {
  arCapabilities = ExpoAr?.getCapabilities() ?? null;
} catch {
  arCapabilities = null;
}

// Физическая высота постера в AR (метры); ширина — по пропорции выбранного размера.
export const AR_POSTER_HEIGHT_M = 0.6;
