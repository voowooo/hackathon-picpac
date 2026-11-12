import { Platform, UIManager } from "react-native";

export const NATIVE = Platform.OS !== "web";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
