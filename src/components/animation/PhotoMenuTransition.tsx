import React, { useEffect, useState } from "react";
import { Animated, Easing, StyleProp, ViewStyle } from "react-native";

export function PhotoMenuTransition({ children, style }: { children: React.ReactNode; style: StyleProp<ViewStyle> }) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress]);
  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}
