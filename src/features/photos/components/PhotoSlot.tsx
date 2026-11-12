import { Ionicons } from "@expo/vector-icons";
import React, { useCallback } from "react";
import { Image, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { photoById } from '../../../domain/photos';
import { styles } from '../../../styles/app.styles';
import { colors } from '../../../styles/theme';
import { Photo, PhotoSlot, ViewRef } from '../../../types/index';

// ═══════════════════════════ Ячейки и 3D ═══════════════════════════
export function EmptySlot({ hint, compact }: { hint?: string; compact?: boolean }) {
  return (
    <View style={styles.emptySlot}>
      <Ionicons name="add-circle-outline" size={compact ? 18 : 24} color={colors.accent} />
      {!compact && hint ? <Text style={styles.emptySlotText}>{hint}</Text> : null}
    </View>
  );
}

export const BookImageReadyContext = React.createContext<((uri: string) => void) | null>(null);

export function BookImageReadyScope({ scope, onReady, children }: { scope: string; onReady: (key: string) => void; children: React.ReactNode }) {
  const ready = useCallback((uri: string) => onReady(`${scope}:${uri}`), [scope, onReady]);
  return <BookImageReadyContext.Provider value={ready}>{children}</BookImageReadyContext.Provider>;
}

export function SlotCell({
  photo, selected, swap, dropHere, onPress, style, compact, hint = "Добавить", innerRef,
}: {
  photo?: Photo; selected?: boolean; swap?: boolean; dropHere?: boolean; onPress?: () => void;
  style?: StyleProp<ViewStyle>; compact?: boolean; hint?: string; innerRef?: (v: ViewRef | null) => void;
}) {
  const onImageReady = React.useContext(BookImageReadyContext);
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={photo ? "Выбрать фото" : "Добавить фото"}
      onPress={onPress} disabled={!onPress}
      style={[styles.slot, style, selected && styles.slotSelected, swap && styles.slotSwap, dropHere && styles.slotDrop]}
    >
      <View ref={innerRef} style={styles.flex} collapsable={false}>
        {photo ? <Image source={{ uri: photo.uri }} style={styles.fill} resizeMode="cover" fadeDuration={0} onLoadEnd={() => onImageReady?.(photo.uri)} /> : <EmptySlot hint={hint} compact={compact} />}
      </View>
      {selected ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.slotSelectionOutline]} /> : null}
    </Pressable>
  );
}

// ═══════════════════════════ Плоский предпросмотр ═══════════════════════════
// Общая ячейка фото для макетов и интерактивных превью.

export function PageSlot({
  slot, photos, label, selectedSlotId, swapSlotId, dropTargetId, onSlotPress, registerSlot, style,
}: {
  slot?: PhotoSlot; photos: Photo[]; label: string;
  selectedSlotId?: string | null; swapSlotId?: string | null; dropTargetId?: string | null;
  onSlotPress?: (slotId: string) => void; registerSlot?: (slotId: string, ref: ViewRef | null) => void;
  style?: StyleProp<ViewStyle>;
}) {
  if (!slot) return null;
  return (
    <SlotCell
      photo={photoById(photos, slot.photoId)}
      selected={slot.id === selectedSlotId}
      swap={slot.id === swapSlotId}
      dropHere={slot.id === dropTargetId}
      onPress={onSlotPress ? () => onSlotPress(slot.id) : undefined}
      innerRef={(v) => registerSlot?.(slot.id, v)}
      style={[styles.pageCell, style]}
      hint={label}
    />
  );
}
