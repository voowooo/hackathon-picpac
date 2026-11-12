import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, Pressable, Text, View } from "react-native";
import { ScalePressable } from '../../components/animation/ScalePressable';
import { Float } from '../../components/ui/index';
import { ORDER_STATUSES, STATUS_ETA, STATUS_ICONS, STATUS_TEXT } from '../../config/catalog';
import { NATIVE } from '../../services/platform';
import { styles } from '../../styles/app.styles';
import { colors, spacing } from '../../styles/theme';
import { IconName, MockOrder } from '../../types/index';
import { clamp, money } from '../../utils/format';

// ═══════════════════════════ Заказы ═══════════════════════════
export function orderStatusStyle(index: number) {
  switch (index) {
    case 0: return { bg: colors.pastelPink, text: colors.accent };
    case 1: return { bg: colors.pastelBlue, text: "#3D6FA5" };
    case 2: return { bg: colors.pastelMint, text: "#3E6B52" };
    case 3: return { bg: colors.pastelSand, text: "#9A6B3F" };
    case 4: return { bg: "#EEF8F1", text: colors.safe };
    default: return { bg: "#F3F0EC", text: colors.textSecondary };
  }
}

export function TrackNode({ icon, state, index }: { icon: IconName; state: "done" | "current" | "todo"; index: number }) {
  const pop = useRef(new Animated.Value(state === "todo" ? 1 : 0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (state === "todo") { pop.setValue(1); return; }
    pop.setValue(0.3);
    const run = Animated.sequence([Animated.delay(index * 220), Animated.spring(pop, { toValue: 1, tension: 160, friction: 7, useNativeDriver: NATIVE })]);
    run.start();
    return () => run.stop();
  }, [state, index, pop]);
  useEffect(() => {
    if (state !== "current") return;
    pulse.setValue(0);
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }));
    loop.start();
    return () => loop.stop();
  }, [state, pulse]);
  const done = state === "done";
  const current = state === "current";
  return (
    <View style={styles.trackNodeBox}>
      {current ? (
        <Animated.View
          style={[styles.trackRing, {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] }) }],
          }]}
        />
      ) : null}
      <Animated.View style={[styles.trackNode, done && styles.trackNodeDone, current && styles.trackNodeCurrent, { transform: [{ scale: pop }] }]}>
        <Ionicons name={done ? "checkmark" : icon} size={done ? 18 : 17} color={done ? "#3B2F00" : current ? colors.accent : "rgba(255,255,255,0.6)"} />
      </Animated.View>
    </View>
  );
}

export function Track({ activeIndex }: { activeIndex: number }) {
  const [w, setW] = useState(0);
  const fill = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const run = Animated.timing(fill, { toValue: activeIndex / (ORDER_STATUSES.length - 1), duration: 300 + activeIndex * 220, delay: 150, easing: Easing.inOut(Easing.cubic), useNativeDriver: false });
    run.start();
    return () => run.stop();
  }, [activeIndex, fill]);
  const lineW = w * 0.8;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <View style={[styles.trackLine, { left: w * 0.1, width: lineW }]}>
        <Animated.View style={[styles.trackFill, { width: fill.interpolate({ inputRange: [0, 1], outputRange: [0, lineW] }) }]} />
      </View>
      <View style={styles.trackRow}>
        {ORDER_STATUSES.map((label, i) => (
          <View key={label} style={styles.trackCol}>
            <TrackNode icon={STATUS_ICONS[i]} index={i} state={i < activeIndex ? "done" : i === activeIndex ? "current" : "todo"} />
            <Text style={[styles.trackLabel, i <= activeIndex && styles.trackLabelOn, i === activeIndex && { fontWeight: "800" }]} numberOfLines={2}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function OrderTracker({ order, onPress }: { order: MockOrder; onPress?: () => void }) {
  const idx = clamp(order.statusIndex, 0, ORDER_STATUSES.length - 1);
  const delivered = idx === ORDER_STATUSES.length - 1;
  return (
    <ScalePressable
      onPress={onPress} disabled={!onPress} scaleTo={0.98} accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`Статус заказа: ${ORDER_STATUSES[idx]}`} wrapStyle={styles.trackerWrap}
    >
      <LinearGradient colors={delivered ? ["#364C49", "#364C49"] : ["#364C49", "#364C49"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tracker}>
        <View style={styles.trackerTop}>
          <Float>
            <View style={styles.trackerBubble}>
              <Ionicons name={STATUS_ICONS[idx]} size={26} color="#fff" />
            </View>
          </Float>
          <View style={{ flex: 1 }}>
            <Text style={styles.trackerKicker} numberOfLines={1}>{order.title} · № {order.id.replace("ord-", "")}</Text>
            <Text style={styles.trackerTitle}>{ORDER_STATUSES[idx]}</Text>
            <Text style={styles.trackerSub}>{STATUS_TEXT[idx]}</Text>
          </View>
          {onPress ? <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" /> : null}
        </View>
        <View style={styles.trackerTrack}>
          <Track activeIndex={idx} />
        </View>
        <View style={styles.trackerFooter}>
          <View style={styles.trackerEta}>
            <Ionicons name={delivered ? "checkmark-circle-outline" : "time-outline"} size={16} color="rgba(255,255,255,0.85)" />
            <Text style={styles.trackerEtaText}>{STATUS_ETA[idx]}</Text>
          </View>
          <Text style={styles.trackerPrice}>{money(order.total)}</Text>
        </View>
      </LinearGradient>
    </ScalePressable>
  );
}

export function OrderCard({ order, onPress, onRepeat }: { order: MockOrder; onPress?: () => void; onRepeat?: () => void }) {
  const pill = orderStatusStyle(order.statusIndex);
  return (
    <Pressable style={styles.orderCard} onPress={onPress} disabled={!onPress}>
      <Image source={{ uri: order.previewUri }} style={styles.orderCardImage} />
      <View style={styles.orderCardBody}>
        <Text style={styles.orderCardTitle} numberOfLines={2}>{order.title}</Text>
        <Text style={styles.orderCardMeta} numberOfLines={1}>{order.scenario} · {order.date}</Text>
        <Text style={styles.orderCardItems} numberOfLines={2}>{order.items}</Text>
        <View style={styles.orderCardFooter}>
          <Text style={styles.orderCardPrice}>{money(order.total)}</Text>
          <View style={[styles.orderStatusPill, { backgroundColor: pill.bg }]}>
            <Text style={[styles.orderStatusText, { color: pill.text }]}>{ORDER_STATUSES[order.statusIndex]}</Text>
          </View>
        </View>
        {onRepeat ? (
          <Pressable onPress={onRepeat} style={{ marginTop: spacing.sm }}>
            <Text style={styles.orderRepeatText}>Повторить заказ</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}
