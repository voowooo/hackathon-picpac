import { Asset } from "expo-asset";

export const HOME_HERO_IMAGES = [
  require("../../assets/home/mountains.jpg"),
  require("../../assets/home/landscape.jpg"),
  require("../../assets/home/lake.jpg"),
] as const;

let homeHeroPreload: Promise<void> | null = null;

/** Предзагрузка декоративных принтов на главной — без белой вспышки при возврате на home. */
export function preloadHomeHeroImages(): Promise<void> {
  if (!homeHeroPreload) {
    homeHeroPreload = Asset.loadAsync([...HOME_HERO_IMAGES]).then(() => undefined);
  }
  return homeHeroPreload;
}
