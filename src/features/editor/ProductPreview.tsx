import { ScrollView, Text, useWindowDimensions, View } from "react-native";
import { POSTER_SIZES } from '../../config/catalog';
import { getPrintFinish, slotPrintFinish, slotPrintFormat } from '../../domain/products';
import { styles } from '../../styles/app.styles';
import { FlatPreviewProps } from '../../types/index';
import { AnimatedBookPreview } from '../photobook/components/AnimatedBookPreview';
import { PageSlot } from '../photos/components/PhotoSlot';
import { Postcard3DPreview } from '../postcard/Postcard3DPreview';

export function FlatPreview({
  cfg, photos, selectedSlotId, swapSlotId, onSlotPress, bookPage, onBookPage, registerSlot, dropTargetId, onTextPress, onInteractionChange,
}: FlatPreviewProps) {
  const { width } = useWindowDimensions();
  const posterSize = POSTER_SIZES.find((s) => s.id === cfg.posterSizeId);
  const stageWidth = Math.min(width - 64, 360);

  // Печать: горизонтальный скролл — один отпечаток на экран.
  if (cfg.category === "print") {
    // Обычная печать: свободный горизонтальный скролл — соседние отпечатки
    // выглядывают по краям, так видно, что фото листаются в сторону.
    // Поля, рамка и размер — свои у каждого отпечатка (переопределение слота).
    const itemW = Math.round(Math.min(width * 0.78, 400));
    const gap = 12;
    return (
      <View style={styles.flatStage}>
        <ScrollView
          horizontal
          snapToInterval={itemW + gap}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          style={{ width }}
          contentContainerStyle={[styles.printScroll, { paddingHorizontal: (width - itemW) / 2, gap }]}
        >
          {cfg.slots.map((slot) => {
            const pFinish = slotPrintFinish(cfg, slot);
            const pFormat = slotPrintFormat(cfg, slot);
            const cardH = Math.round(itemW / pFormat.ratio);
            const ppx = Math.max(itemW, cardH) / (Math.max(...pFormat.id.split("x").map(Number)) * 10);
            return (
              <View
                key={slot.id}
                style={[styles.printCard, {
                  width: itemW,
                  height: cardH,
                  padding: pFinish.margin * ppx,
                  backgroundColor: pFinish.marginColor,
                }]}
              >
                <View style={{ flex: 1, padding: pFinish.frame * ppx, backgroundColor: pFinish.frame > 0 ? pFinish.frameColor : "transparent" }}>
                  <View style={{ flex: 1, overflow: "hidden" }}>
                    <PageSlot
                      slot={slot} photos={photos} label="Фото"
                      selectedSlotId={selectedSlotId} swapSlotId={swapSlotId} dropTargetId={dropTargetId}
                      onSlotPress={onSlotPress} registerSlot={registerSlot} style={{ flex: 1 }}
                    />
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
        <Text style={styles.flatNote}>Отпечатки: {cfg.slots.length} шт · листайте в сторону</Text>
      </View>
    );
  }

  // Постер: один лист с полями и рамкой.
  if (cfg.category === "poster") {
    const [pw, ph] = (posterSize?.label ?? "30×40").split("×").map((x) => parseFloat(x));
    const ratio = cfg.posterOrientation === "portrait" ? pw / ph : ph / pw;
    const w = stageWidth;
    const h = Math.round(w / ratio);
    const pxPerMm = Math.max(w, h) / (Math.max(pw, ph) * 10);
    const finish = getPrintFinish(cfg, "poster");
    return (
      <View style={styles.flatStage}>
        <View style={[styles.printCard, { width: w, height: h, padding: finish.margin * pxPerMm, backgroundColor: finish.marginColor }]}>
          <View style={{ flex: 1, padding: finish.frame * pxPerMm, backgroundColor: finish.frame > 0 ? finish.frameColor : "transparent" }}>
            <View style={{ flex: 1, overflow: "hidden" }}>
              <PageSlot
                slot={cfg.slots[0]} photos={photos} label="Фото"
                selectedSlotId={selectedSlotId} swapSlotId={swapSlotId} dropTargetId={dropTargetId}
                onSlotPress={onSlotPress} registerSlot={registerSlot} style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
        <Text style={styles.flatNote}>{posterSize?.label} · {cfg.posterOrientation === "portrait" ? "вертикальный" : "горизонтальный"}</Text>
      </View>
    );
  }

  // Открытка: лицевая сторона и оборот с подписью.
  if (cfg.category === "postcard") {
    return (
      <Postcard3DPreview cfg={cfg} photos={photos} selectedSlotId={selectedSlotId} swapSlotId={swapSlotId} onSlotPress={onSlotPress} bookPage={bookPage} onBookPage={onBookPage} registerSlot={registerSlot} dropTargetId={dropTargetId} onTextPress={onTextPress} onInteractionChange={onInteractionChange} />
    );
  }

  return (
    <AnimatedBookPreview
      cfg={cfg} photos={photos} selectedSlotId={selectedSlotId} swapSlotId={swapSlotId} onSlotPress={onSlotPress}
      bookPage={bookPage} onBookPage={onBookPage} registerSlot={registerSlot} dropTargetId={dropTargetId} onTextPress={onTextPress}
    />
  );
}
