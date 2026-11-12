import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Text, View } from "react-native";
import { NATIVE } from '../../services/platform';
import { styles } from '../../styles/app.styles';
import { colors } from '../../styles/theme';
import { IconName } from '../../types/index';
import { clamp } from '../../utils/format';
import { ScalePressable } from '../animation/ScalePressable';

export function ProgressBar({ value }: { value: number }) {
  const progress = useRef(new Animated.Value(value)).current;
  useEffect(() => {
    Animated.timing(progress, { toValue: clamp(value, 0, 1), duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [value, progress]);
  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]} />
    </View>
  );
}

export function Float({ children }: { children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
        Animated.timing(v, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={{ transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [2, -3] }) }] }}>{children}</Animated.View>;
}

// ═══════════════════════════ Базовые элементы ═══════════════════════════
export function PrimaryButton({
  label, onPress, disabled, variant = "primary", icon,
}: { label: string; onPress: () => void; disabled?: boolean; variant?: "primary" | "secondary"; icon?: IconName }) {
  const isPrimary = variant === "primary";
  const textColor = disabled ? colors.textSecondary : isPrimary ? "#fff" : colors.text;
  return (
    <ScalePressable
      onPress={onPress} disabled={disabled} accessibilityRole="button" scaleTo={0.97}
      style={[styles.btn, isPrimary ? styles.btnFill : styles.btnOutline, disabled && styles.btnDisabled]}
    >
      {icon ? <Ionicons name={icon} size={18} color={textColor} /> : null}
      <Text style={[styles.btnText, { color: textColor }]}>{label}</Text>
    </ScalePressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <ScalePressable onPress={onPress} disabled={!onPress} scaleTo={0.94} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </ScalePressable>
  );
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionTitleWrap}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function SettingGroup({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.settingGroup}>
      <Text style={styles.settingGroupTitle}>{title}</Text>
      {hint ? <Text style={styles.settingGroupHint}>{hint}</Text> : null}
      <View style={styles.settingGroupChips}>{children}</View>
    </View>
  );
}

export function Stepper({
  label, onMinus, onPlus, minusDisabled, plusDisabled,
}: { label: string; onMinus: () => void; onPlus: () => void; minusDisabled?: boolean; plusDisabled?: boolean }) {
  return (
    <View style={styles.stepper}>
      <ScalePressable onPress={onMinus} disabled={minusDisabled} scaleTo={0.9} style={[styles.stepperBtn, minusDisabled && styles.stepperBtnOff]}>
        <Ionicons name="remove" size={20} color={colors.text} />
      </ScalePressable>
      <Text style={styles.stepperLabel}>{label}</Text>
      <ScalePressable onPress={onPlus} disabled={plusDisabled} scaleTo={0.9} style={[styles.stepperBtn, plusDisabled && styles.stepperBtnOff]}>
        <Ionicons name="add" size={20} color={colors.text} />
      </ScalePressable>
    </View>
  );
}
