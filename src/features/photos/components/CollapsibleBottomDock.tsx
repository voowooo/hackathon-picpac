import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Animated, Easing, Pressable, StyleProp, Text, View, ViewStyle } from "react-native";
import { styles } from '../../../styles/app.styles';
import { colors } from '../../../styles/theme';
import type { IconName } from '../../../types/index';

export function CollapsibleBottomDock({
  title,
  legend,
  icon = "file-tray-full-outline",
  disabled,
  dockStyle,
  children,
}: {
  title: string;
  legend?: string;
  icon?: IconName;
  disabled?: boolean;
  dockStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [bodyHeight, setBodyHeight] = useState(0);
  const [reveal] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const animation = Animated.timing(reveal, {
      toValue: collapsed ? 0 : 1,
      duration: 320,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [collapsed, reveal]);

  return (
    <View style={[styles.trayDock, dockStyle]}>
      <Pressable
        style={styles.trayHeader}
        onPress={() => setCollapsed(value => !value)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ expanded: !collapsed }}
        accessibilityLabel={collapsed ? "Показать панель" : "Скрыть панель"}
      >
        <Ionicons name={icon} size={20} color={colors.text} />
        <Text style={styles.trayTitle}>{title}</Text>
        <Text style={styles.trayLegend}>{legend ?? (collapsed ? "Показать" : "Скрыть")}</Text>
        <Animated.View style={{ transform: [{ rotate: reveal.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "0deg"] }) }] }}>
          <Ionicons name="chevron-down" size={20} color={colors.text} />
        </Animated.View>
      </Pressable>
      <Animated.View
        pointerEvents={collapsed ? "none" : "auto"}
        accessibilityElementsHidden={collapsed}
        importantForAccessibility={collapsed ? "no-hide-descendants" : "auto"}
        style={{ height: Animated.multiply(reveal, bodyHeight), overflow: "hidden" }}
      >
        <Animated.View
          onLayout={event => setBodyHeight(event.nativeEvent.layout.height)}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            paddingTop: 8,
            paddingBottom: 4,
            opacity: reveal,
            transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
          }}
        >
          {children}
        </Animated.View>
      </Animated.View>
    </View>
  );
}
