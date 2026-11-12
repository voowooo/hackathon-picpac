import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NATIVE } from '../../services/platform';
import { styles } from '../../styles/app.styles';
import { colors, spacing } from '../../styles/theme';
import { IconName } from '../../types/index';
import { ScalePressable } from '../animation/ScalePressable';
import { FrostedBackground } from '../ui/FrostedSurface';

// Индикатор шагов заказа: Фото → Макет → Заказ.
export function StepBar({ step }: { step: 1 | 2 | 3 }) {
  const labels = ["Фото", "Макет", "Заказ"];
  return (
    <View style={styles.stepBar}>
      {labels.map((l, i) => {
        const n = i + 1;
        const done = n < step;
        const on = n === step;
        return (
          <React.Fragment key={l}>
            {i > 0 ? <View style={[styles.stepLine, n <= step && styles.stepLineOn]} /> : null}
            <View style={styles.stepItem}>
              <View style={[styles.stepDot, (done || on) && styles.stepDotOn]}>
                {done ? <Ionicons name="checkmark" size={12} color="#fff" /> : <Text style={[styles.stepNum, on && { color: "#fff" }]}>{n}</Text>}
              </View>
              <Text style={[styles.stepLabel, on && { color: colors.accent, fontWeight: "800" }]}>{l}</Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

export function ScreenHeader({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screenHeader, { position: 'absolute', top: -insets.top, left: 0, right: 0, paddingTop: insets.top + 8, height: insets.top + 64, zIndex: 40 }]}>
      <FrostedBackground />
      <View style={styles.headerSide}>
        {onBack ? (
          <ScalePressable onPress={onBack} style={styles.backBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel="Назад" scaleTo={0.88}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </ScalePressable>
        ) : null}
      </View>
      <Text style={styles.screenHeaderTitle} numberOfLines={1}>{title}</Text>
      <View style={[styles.headerSide, { alignItems: "flex-end" }]}>{right}</View>
    </View>
  );
}

export function NavItem({
  active, label, icon, activeIcon, onPress,
}: { active: boolean; label: string; icon: IconName; activeIcon: IconName; onPress: () => void }) {
  const a = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(a, { toValue: active ? 1 : 0, tension: 160, friction: 12, useNativeDriver: NATIVE }).start();
  }, [active, a]);
  return (
    <Pressable onPress={onPress} style={styles.bottomNavItem} accessibilityRole="button" accessibilityState={{ selected: active }}>
      <Animated.View
        style={[styles.navPill, {
          transform: [
            { scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) },
            { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -1] }) },
          ],
        }]}
      >
        <Ionicons name={active ? activeIcon : icon} size={22} color={active ? colors.accentBright : colors.accent} />
      </Animated.View>
      <Text style={[styles.bottomNavLabel, active && styles.bottomNavLabelActive]}>{label}</Text>
    </Pressable>
  );
}

export function BottomNav({
  active, onHome, onOrders, onProfile,
}: { active: "home" | "orders" | "profile"; onHome: () => void; onOrders: () => void; onProfile: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bottomNav, { bottom: Math.max(insets.bottom, spacing.sm) - 12 }]} accessibilityRole="tablist">
      <FrostedBackground />
      <View style={styles.bottomNavRow}>
        <NavItem active={active === "home"} label="Главная" icon="home-outline" activeIcon="home" onPress={onHome} />
        <NavItem active={active === "orders"} label="Заказы" icon="receipt-outline" activeIcon="receipt" onPress={onOrders} />
        <NavItem active={active === "profile"} label="Профиль" icon="person-outline" activeIcon="person" onPress={onProfile} />
      </View>
    </View>
  );
}
