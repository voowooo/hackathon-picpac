import { Ionicons } from "@expo/vector-icons";
import React, { useRef } from "react";
import { Image, PanResponder, Pressable, ScrollView, Text, View } from "react-native";
import { styles } from '../../../styles/app.styles';
import { colors } from '../../../styles/theme';
import { Photo, PhotoSlot } from '../../../types/index';
import { CollapsibleBottomDock } from "./CollapsibleBottomDock";

// Миниатюра в лотке: тап ставит фото в ячейку, потягивание вверх переносит его на страницу.
export function TrayThumb({
  photo, used, selected, dragging, onPick, onDragStart, onDragMove, onDragDrop, onDragIntent,
}: {
  photo: Photo; used: boolean; selected: boolean; dragging: boolean;
  onPick: () => void;
  onDragStart: (photoId: string, x: number, y: number) => void;
  onDragMove: (photoId: string, x: number, y: number) => void;
  onDragDrop: (photoId: string, x: number, y: number) => void;
  onDragIntent: () => void;
}) {
  const live = useRef({ onPick, onDragStart, onDragMove, onDragDrop, onDragIntent, photoId: photo.id });
  live.current = { onPick, onDragStart, onDragMove, onDragDrop, onDragIntent, photoId: photo.id };
  const pan = useRef(
    PanResponder.create({
      // Забираем жест только при движении вверх — горизонтальный свайп оставляем прокрутке лотка.
      // Блокировку скролла запускаем ещё до захвата жеста: нативный скролл не должен успеть его отобрать.
      onMoveShouldSetPanResponder: (_, g) => {
        const take = Math.hypot(g.dx, g.dy) > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 0.6;
        if (take) live.current.onDragIntent();
        return take;
      },
      onPanResponderGrant: (e) => live.current.onDragStart(live.current.photoId, e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPanResponderMove: (e) => live.current.onDragMove(live.current.photoId, e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPanResponderRelease: (e) => live.current.onDragDrop(live.current.photoId, e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPanResponderTerminate: (e) => live.current.onDragDrop(live.current.photoId, e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;
  return (
    <View {...pan.panHandlers}>
      <Pressable
        accessibilityRole="button" accessibilityLabel={used ? "Фото уже в макете" : "Поставить фото в ячейку"}
        onPress={() => live.current.onPick()}
        style={[styles.trayThumb, selected && styles.trayThumbSelected, dragging && styles.trayThumbDragging]}
      >
        <Image source={{ uri: photo.uri }} style={[styles.fill, !used && { opacity: 0.92 }]} />
        {used ? (
          <View style={styles.trayBadge}>
            <Ionicons name="checkmark" size={10} color="#fff" />
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

// Лоток закреплён внизу редактора: буфер, из которого фото попадают на страницы книги.
// ВАЖНО: компонент объявлен на уровне модуля. Вложенное объявление внутри PicPacApp
// создавало новый тип компонента на каждый ре-рендер — лоток перемонтировался,
// и жест перетаскивания обрывался («фото зависает чуть выше лотка»).
export function PhotoTray({
  photos, slots, selectedPhotoId, draggingId, scrollLocked, note, top, onPick, onAdd, onDragStart, onDragMove, onDragDrop, onDragIntent,
}: {
  photos: Photo[]; slots: PhotoSlot[]; selectedPhotoId?: string; draggingId?: string | null; scrollLocked: boolean;
  note: string; top?: React.ReactNode;
  onPick: (photoId: string) => void; onAdd: () => void;
  onDragStart: (photoId: string, x: number, y: number) => void;
  onDragMove: (photoId: string, x: number, y: number) => void;
  onDragDrop: (photoId: string, x: number, y: number) => void;
  onDragIntent: () => void;
}) {
  const used = new Set(slots.map((s) => s.photoId).filter(Boolean));
  return (
    <CollapsibleBottomDock
      title={`Лоток фото · ${photos.length}`}
      disabled={!!draggingId || scrollLocked}
    >
      <Text style={styles.trayNote}>{note || 'Перетащите фото в макет или нажмите на снимок'}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trayRow} scrollEnabled={!scrollLocked}>
        {photos.map((p) => (
          <TrayThumb
            key={p.id} photo={p} used={used.has(p.id)} selected={p.id === selectedPhotoId} dragging={draggingId === p.id}
            onPick={() => onPick(p.id)} onDragStart={onDragStart} onDragMove={onDragMove} onDragDrop={onDragDrop}
            onDragIntent={onDragIntent}
          />
        ))}
        <Pressable onPress={onAdd} style={styles.trayAdd}>
          <Ionicons name="add" size={22} color={colors.accent} />
          <Text style={styles.trayAddText}>Ещё</Text>
        </Pressable>
      </ScrollView>
      {top}
    </CollapsibleBottomDock>
  );
}
