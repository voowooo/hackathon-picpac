import { BookPageDepth } from './BookPageDepth';
import { Pressable, Text, View } from "react-native";
import { COVER_COLORS } from '../../../config/catalog';
import { styles } from '../../../styles/app.styles';
import { FlatPreviewProps } from '../../../types/index';
import { normalizeHexColor } from '../../../utils/format';
import { PageSlot } from '../../photos/components/PhotoSlot';

export function BookCoverFlat({
  cfg, photos, width, height, selectedSlotId, swapSlotId, dropTargetId, onSlotPress, onTextPress, registerSlot,
}: FlatPreviewProps & { width: number; height: number }) {
  const framed = cfg.coverStyle === "framed";
  const frameWidth = cfg.coverFrameWidth ?? 14;
  const frameColor = normalizeHexColor(cfg.coverFrameColor ?? COVER_COLORS.find((c) => c.id === cfg.coverColorId)?.color, "#F5E6D3");
  const showTitle = cfg.coverShowTitle ?? true;
  const titleColor = normalizeHexColor(cfg.coverTitleColor, "#FFFFFF");
  const titleNode = (
    <Pressable
      disabled={!onTextPress} accessibilityRole="button" accessibilityLabel="Изменить название альбома"
      onPress={() => onTextPress?.("bookTitle")}
    >
      <Text style={[styles.coverFlatTitle, { color: titleColor }]} numberOfLines={2}>{cfg.bookTitle}</Text>
    </Pressable>
  );
  return (
    <View style={[styles.coverFlat, { width, height, backgroundColor: framed ? frameColor : "#F5E6D3" }]}>
      {/* Фото: на весь лист без рамок либо в рамке выбранной ширины и цвета */}
      <View style={[styles.coverPhotoArea, framed ? { padding: frameWidth } : null, !framed ? { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } : null]}>
        <PageSlot
          slot={cfg.slots[0]} photos={photos} label="Обложка"
          selectedSlotId={selectedSlotId} swapSlotId={swapSlotId} dropTargetId={dropTargetId}
          onSlotPress={onSlotPress} registerSlot={registerSlot} style={{ flex: 1 }}
        />
      </View>
      {showTitle ? <View pointerEvents="box-none" style={styles.coverTitleOverlay}>{titleNode}</View> : null}
      <BookPageDepth side="cover"/>
    </View>
  );
}
