import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, StyleProp, StyleSheet, useWindowDimensions, View, ViewStyle } from "react-native";
import { NATIVE } from '../../services/platform';
import { styles } from '../../styles/app.styles';

export function Overlay({
  visible, onClose, variant = "bottom", style, label, children,
}: {
  visible: boolean; onClose: () => void; variant?: "bottom" | "center"; style?: StyleProp<ViewStyle>; label: string; children: React.ReactNode;
}) {
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.spring(progress, {
        toValue: 1, tension: variant === "bottom" ? 90 : 130, friction: variant === "bottom" ? 14 : 12,
        overshootClamping: variant === "bottom", useNativeDriver: NATIVE,
      }).start();
    } else {
      Animated.timing(progress, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: NATIVE }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, progress, variant]);
  if (!mounted) return null;
  const fade = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: "clamp" });
  const motion =
    variant === "bottom"
      ? { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }] }
      : { opacity: fade, transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] };
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.flex}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(20,32,26,.42)", opacity: fade }]}>
          <Pressable style={styles.flex} accessibilityLabel={label} onPress={onClose} />
        </Animated.View>
        <KeyboardAvoidingView
          pointerEvents="box-none"
          style={[styles.flex, variant === "bottom" ? { justifyContent: "flex-end" } : { justifyContent: "center", padding: 24 }]}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Animated.View style={[style, motion]}>{children}</Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
