import { useRef } from "react";
import { PanResponder, Text, useWindowDimensions, View } from "react-native";
import { styles } from '../../../styles/app.styles';
import { MockupProps, ViewRef } from '../../../types/index';
import { parseRatio } from '../../../utils/format';
import { SpreadPageHalf } from './SpreadPageHalf';

// Интерактивный разворот. Анимацией перелистывания управляет AnimatedBookPreview.
export function BookSpreadView({
  cfg, photos, page, onPage, selectedSlotId, swapSlotId, onSlotPress, registerSlot, dropTargetId, width: fixedWidth,
}: MockupProps & {
  page: number; onPage: (n: number) => void; width?: number;
  registerSlot?: (slotId: string, ref: ViewRef | null) => void; dropTargetId?: string | null;
}) {
  const { width: winWidth } = useWindowDimensions();
  const w = Math.round(fixedWidth ?? Math.min(winWidth - 56, 420));
  const h = Math.round(w / (2 * parseRatio(cfg.bookFormat)));
  const geometry = { pad: 10, gap: 4, pageW: (w - 20) / 2, pageH: h - 20 };
  const pageNo = page * 2;

  const live = useRef({ page, onPage, max: cfg.spreads });
  live.current = { page, onPage, max: cfg.spreads };
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, g) => {
        const { page: p, onPage: go, max } = live.current;
        if (g.dx < -40 && p < max) go(p + 1);
        else if (g.dx > 40 && p > 0) go(p - 1);
      },
    }),
  ).current;

  return (
    <View style={styles.spreadStage} {...swipe.panHandlers}>
      <View style={[styles.spreadBook, { width: w, height: h }]}>
        <View style={styles.spreadPages}>
          <SpreadPageHalf
            cfg={cfg} photos={photos} page={page} side="left" geometry={geometry}
            selectedSlotId={selectedSlotId} swapSlotId={swapSlotId} dropTargetId={dropTargetId}
            onSlotPress={onSlotPress} registerSlot={registerSlot}
          />
          <SpreadPageHalf
            cfg={cfg} photos={photos} page={page} side="right" geometry={geometry}
            selectedSlotId={selectedSlotId} swapSlotId={swapSlotId} dropTargetId={dropTargetId}
            onSlotPress={onSlotPress} registerSlot={registerSlot}
          />
          <Text style={[styles.spreadNum, { left: 12 }]}>{pageNo}</Text>
          <Text style={[styles.spreadNum, { right: 12 }]}>{pageNo + 1}</Text>
        </View>
      </View>
      {/* <Text style={styles.spreadHint}>Листайте свайпом · нажмите на фото, чтобы выбрать</Text> */}
    </View>
  );
}
