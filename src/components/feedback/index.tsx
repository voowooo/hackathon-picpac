import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { NATIVE } from '../../services/platform';
import { styles } from '../../styles/app.styles';
import { colors } from '../../styles/theme';
import { IconName } from '../../types/index';

export function Toast({ toast, top }: { toast: { id: number; text: string; icon: IconName } | null; top: number }) {
  const [progress] = useState(() => new Animated.Value(0));
  const [endedId, setEndedId] = useState<number | null>(null);
  useEffect(() => {
    if (!toast) return;
    progress.setValue(0);
    const run = Animated.sequence([
      Animated.spring(progress, { toValue: 1, tension: 120, friction: 12, useNativeDriver: NATIVE }),
      Animated.delay(1900),
      Animated.timing(progress, { toValue: 0, duration: 240, useNativeDriver: NATIVE }),
    ]);
    run.start(({ finished }) => { if (finished) setEndedId(toast.id); });
    return () => run.stop();
  }, [toast, progress]);
  if (!toast || endedId === toast.id) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.toast, {
        top,
        opacity: progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1], extrapolate: "clamp" }),
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
      }]}
    >
      <Ionicons name={toast.icon} size={18} color={colors.accentYellow} />
      <Text style={styles.toastText}>{toast.text}</Text>
    </Animated.View>
  );
}

export function Notice({
  tone, icon, text, actionLabel, onAction,
}: { tone: "info" | "warn" | "ai"; icon: IconName; text: string; actionLabel?: string; onAction?: () => void }) {
  const warn = tone === "warn";
  const ai = tone === "ai";
  const tint = warn ? colors.danger : ai ? colors.ai : colors.accent;
  return (
    <View style={[styles.notice, warn ? styles.noticeWarn : ai ? styles.noticeAi : styles.noticeInfo]}>
      <Ionicons name={icon} size={18} color={tint} />
      <Text style={[styles.noticeText, (warn || ai) && { color: tint }]}>{text}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={styles.noticeAction}>
          <Text style={[styles.noticeActionText, { color: tint }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
