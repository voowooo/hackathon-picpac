import React, { useEffect, useState } from "react";
import { Animated, Easing, View } from "react-native";

export function BookSettingsSection({ active, children }: { active: boolean; children: React.ReactNode }) {
  const [height, setHeight] = useState(0);
  const [reveal] = useState(() => new Animated.Value(active ? 1 : 0));
  useEffect(() => {
    const animation = Animated.timing(reveal, { toValue: active ? 1 : 0, duration: 300, easing: Easing.inOut(Easing.cubic), useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [active, reveal]);
  return (
    <Animated.View pointerEvents={active ? "auto" : "none"} accessibilityElementsHidden={!active} importantForAccessibility={active ? "auto" : "no-hide-descendants"} style={{ height: Animated.multiply(reveal, height), overflow: "hidden", opacity: reveal }}>
      <View onLayout={(event) => setHeight(event.nativeEvent.layout.height)} style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
        {children}
      </View>
    </Animated.View>
  );
}
