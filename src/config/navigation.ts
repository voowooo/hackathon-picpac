import { Screen } from '../types/index';

export const SCREEN_DEPTH: Record<Screen, number> = { home: 0, orders: 1, profile: 1, productPicker: 1, photoPicker: 2, bookSetup: 2, builder: 2, checkout: 3 };

export const SCREEN_PATHS = {
  home: "/", productPicker: "/products", photoPicker: "/photos", bookSetup: "/book-setup",
  builder: "/builder", checkout: "/checkout", orders: "/orders", profile: "/profile",
} as const satisfies Record<Screen, string>;

export function screenFromPath(pathname: string): Screen {
  return (Object.keys(SCREEN_PATHS) as Screen[]).find((screen) => SCREEN_PATHS[screen] === pathname) ?? "home";
}
