import React, { useEffect, useState } from "react";
import { Animated, Easing } from "react-native";
import { NATIVE } from '../../services/platform';

// ═══════════════════════════ Анимации ═══════════════════════════
// Для kind="product" только прозрачность: scale/translate на контейнере 3D-изделия растеризовали слой и размывали края.
export function MotionView({
  children, style, kind = "section", dir = 1, delay = 0, staticContent = false,
}: {
  children: React.ReactNode;
  style?: React.ComponentProps<typeof Animated.View>["style"];
  kind?: "screen" | "product" | "section";
  dir?: 1 | -1;
  delay?: number;
  staticContent?: boolean;
}) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (staticContent) return;
    const animation =
      kind === "screen"
        ? Animated.spring(progress, { toValue: 1, tension: 85, friction: 13, overshootClamping: true, useNativeDriver: NATIVE })
        : Animated.timing(progress, { toValue: 1, delay, duration: kind === "product" ? 220 : 380, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE });
    animation.start();
    return () => animation.stop();
  }, [progress, kind, delay, staticContent]);
  if (staticContent) return <Animated.View style={style}>{children}</Animated.View>;
  const opacity = progress.interpolate({ inputRange: [0, 0.7], outputRange: [0, 1], extrapolate: "clamp" });
  if (kind === "product") return <Animated.View testID="motion-product" style={[style, { opacity }]}>{children}</Animated.View>;
  const shiftX = kind === "screen" ? dir * 38 : 0;
  const lift = kind === "section" ? 14 : 0;
  const scale = kind === "screen" ? 0.985 : 1;
  return (
    <Animated.View
      testID={`motion-${kind}`}
      style={[
        style,
        {
          opacity,
          transform: [
            { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [shiftX, 0] }) },
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [lift, 0] }) },
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [scale, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
