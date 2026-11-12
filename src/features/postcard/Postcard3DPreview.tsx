import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, PanResponder, Platform, Pressable, Text, useWindowDimensions, View } from "react-native";
import { POSTCARD_TEMPLATES } from '../../config/catalog';
import { styles } from '../../styles/app.styles';
import { colors } from '../../styles/theme';
import { FlatPreviewProps } from '../../types/index';
import { clamp } from '../../utils/format';
import { PageSlot } from '../photos/components/PhotoSlot';
import { postcardShowsBack, snapPostcardYaw } from "./pose";

export function Postcard3DPreview({ cfg, photos, selectedSlotId, swapSlotId, dropTargetId, onSlotPress, onTextPress, registerSlot, onInteractionChange }: FlatPreviewProps) {
  const { width } = useWindowDimensions();
  const w = Math.min(width - 112, 276);
  const h = Math.round(w * 1.4);
  const template = POSTCARD_TEMPLATES.find((item) => item.id === cfg.postcardTemplateId);
  const [rotation] = useState(() => new Animated.ValueXY({ x: 0, y: 0 }));
  const [back, setBack] = useState(false);
  const [settling, setSettling] = useState(false);
  const pose = useRef({ x: 0, y: 0, startX: 0, startY: 0 });
  const motionId = useRef(0);
  const faces = useMemo(() => {
    const normalized = Animated.modulo(rotation.y, 360);
    const frontOpacity = normalized.interpolate({ inputRange: [0, 89.9, 90, 270, 270.1, 360], outputRange: [1, 1, 0, 0, 1, 1] });
    const pitch = rotation.x.interpolate({ inputRange: [0, 360], outputRange: ["0deg", "360deg"] });
    return {
      front: { opacity: frontOpacity, transform: [{ perspective: 1000 }, { rotateX: pitch }, { rotateY: rotation.y.interpolate({ inputRange: [0, 360], outputRange: ["0deg", "360deg"] }) }] },
      back: { opacity: Animated.subtract(1, frontOpacity), transform: [{ perspective: 1000 }, { rotateX: pitch }, { rotateY: Animated.subtract(rotation.y, 180).interpolate({ inputRange: [0, 360], outputRange: ["0deg", "360deg"] }) }] },
    };
  }, [rotation]);
  useEffect(() => () => onInteractionChange?.(false), [onInteractionChange]);
  useEffect(() => {
    const xId = rotation.x.addListener(({ value }) => { pose.current.x = value; });
    const yId = rotation.y.addListener(({ value }) => {
      pose.current.y = value;
      setBack(postcardShowsBack(value));
    });
    return () => { motionId.current += 1; rotation.x.removeListener(xId); rotation.y.removeListener(yId); rotation.stopAnimation(); };
  }, [rotation]);

  const align = (yaw: number, after?: () => void) => {
    const id = ++motionId.current;
    rotation.stopAnimation();
    setSettling(true);
    Animated.timing(rotation, { toValue: { x: 0, y: snapPostcardYaw(yaw) }, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(({ finished }) => {
      if (id !== motionId.current) return;
      setSettling(false);
      onInteractionChange?.(false);
      if (finished) after?.();
    });
  };
  // PanResponder stores these callbacks; pose is read only when a gesture fires.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponderCapture: (_, g) => Math.hypot(g.dx, g.dy) > 7,
    onPanResponderGrant: () => {
      onInteractionChange?.(true);
      motionId.current += 1;
      rotation.stopAnimation();
      setSettling(false);
      pose.current.startX = pose.current.x;
      pose.current.startY = pose.current.y;
    },
    onPanResponderMove: (_, g) => {
      const x = clamp(pose.current.startX - g.dy * 0.3, -32, 32);
      const y = pose.current.startY + g.dx * 0.7;
      pose.current.x = x; pose.current.y = y;
      rotation.setValue({ x, y });
    },
    onPanResponderRelease: () => {
      onInteractionChange?.(false);
      align(snapPostcardYaw(pose.current.y));
    },
    onPanResponderTerminate: () => {
      onInteractionChange?.(false);
      align(snapPostcardYaw(pose.current.y));
    },
    onPanResponderTerminationRequest: () => false,
  }));
  const editPhoto = (id: string) => align(snapPostcardYaw(pose.current.y), () => onSlotPress?.(id));
  const sideProps = { photos, selectedSlotId, swapSlotId, dropTargetId, onSlotPress: onSlotPress ? editPhoto : undefined };
  return (
    <View style={[styles.flatStage, styles.postcard3DStage]}>
      <View
        style={{ width: "100%", height: h + 28, alignItems: "center", justifyContent: "center", ...(Platform.OS === "web" ? { touchAction: "none" } : {}) }}
        onTouchStart={() => onInteractionChange?.(true)}
        onTouchEnd={(event) => { if (!event.nativeEvent.touches.length) onInteractionChange?.(false); }}
        onTouchCancel={() => onInteractionChange?.(false)}
        {...pan.panHandlers}
      >
        <View style={{ width: w, height: h }}>
          <Animated.View key="front" pointerEvents={!back && !settling ? "auto" : "none"} aria-hidden={back} accessibilityElementsHidden={back} importantForAccessibility={back ? "no-hide-descendants" : "auto"} style={[styles.postcard3DFace, { backgroundColor: "#fffdfa" }, faces.front]}>
            <View style={styles.postcardFront}>
              <PageSlot {...sideProps} slot={cfg.slots[0]} label="Добавить фото" registerSlot={!back ? registerSlot : undefined} style={styles.flex} />
            </View>
          </Animated.View>
          <Animated.View key="back" pointerEvents={back && !settling ? "auto" : "none"} aria-hidden={!back} accessibilityElementsHidden={!back} importantForAccessibility={!back ? "no-hide-descendants" : "auto"} style={[styles.postcard3DFace, { backgroundColor: template?.tint ?? "#fffdfa" }, faces.back]}>
            <View style={styles.postcardBack}>
              <View style={styles.postcardBackTop}>
                <View style={{ width: 64, height: 76 }}>
                  <PageSlot {...sideProps} slot={cfg.slots[1]} label="Фото" registerSlot={back ? registerSlot : undefined} style={styles.flex} />
                </View>
                <View style={styles.postcardStamp}><Ionicons name="heart-outline" size={16} color={colors.textSecondary} /></View>
              </View>
              <Pressable
                style={styles.postcardCaptionBox} accessibilityRole="button" accessibilityLabel="Редактировать текст открытки" disabled={!onTextPress}
                onPress={() => align(snapPostcardYaw(pose.current.y), () => onTextPress?.("postcardCaption"))}
              >
                <Text style={styles.postcardCaption}>{cfg.postcardCaption || "Нажмите, чтобы написать"}</Text>
                {onTextPress ? <Ionicons name="create-outline" size={16} color={colors.accent} /> : null}
              </Pressable>
              <View style={styles.postcardLine} /><View style={styles.postcardLine} />
            </View>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}
