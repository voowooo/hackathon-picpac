import React, { useRef } from "react";
import { Animated, Pressable, StyleProp, ViewStyle } from "react-native";
import { NATIVE } from '../../services/platform';

export function ScalePressable({
  children, style, wrapStyle, scaleTo = 0.96, onPressIn, onPressOut, ...rest
}: Omit<React.ComponentProps<typeof Pressable>, "style" | "children"> & {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; wrapStyle?: StyleProp<ViewStyle>; scaleTo?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (value: number) => Animated.spring(scale, { toValue: value, tension: 260, friction: 16, useNativeDriver: NATIVE }).start();
  return (
    <Animated.View style={[wrapStyle, { transform: [{ scale }] }]}>
      <Pressable
        {...rest}
        onPressIn={(e) => { if (!rest.disabled) to(scaleTo); onPressIn?.(e); }}
        onPressOut={(e) => { to(1); onPressOut?.(e); }}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
