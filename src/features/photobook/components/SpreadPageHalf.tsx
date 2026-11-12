import { View } from "react-native";
import { photoById } from '../../../domain/photos';
import { spreadLayoutOf, spreadSlotsFor } from '../../../domain/products';
import { styles } from '../../../styles/app.styles';
import { Photo, ProductConfig, ViewRef } from '../../../types/index';
import { SlotCell } from '../../photos/components/PhotoSlot';

// Пол-разворота: ячейки сетки конкретной страницы для левой или правой стороны.
// Используется и для нижнего слоя, и для «листов» анимации перелистывания.
export function SpreadPageHalf({
  cfg, photos, page, side, geometry, selectedSlotId, swapSlotId, dropTargetId, onSlotPress, registerSlot,
}: {
  cfg: ProductConfig; photos: Photo[]; page: number; side: "left" | "right";
  geometry: { pad: number; gap: number; pageW: number; pageH: number };
  selectedSlotId?: string | null; swapSlotId?: string | null; dropTargetId?: string | null;
  onSlotPress?: (slotId: string) => void; registerSlot?: (slotId: string, ref: ViewRef | null) => void;
}) {
  const layout = spreadLayoutOf(cfg, page);
  const slots = spreadSlotsFor(cfg, page);
  const { pad, gap, pageW, pageH } = geometry;
  return (
    // box-none: половина — контейнер на всю книгу, касания проходят сквозь неё
    // к ячейкам (иначе правая половина перекрывает ячейки левой страницы).
    <View pointerEvents="box-none" style={styles.spreadPages}>
      {layout.cells.map((c, i) => {
        const slot = slots[i];
        if (!slot) return null;
        if (side === "left" ? c.x >= 1 : c.x < 1) return null;
        // Половина рисуется поверх всего разворота, поэтому правой странице нужен сдвиг на её ширину.
        const x = side === "left" ? c.x : c.x - 1;
        const offsetX = side === "left" ? 0 : pageW;
        const nearLeft = x > 0;
        const nearTop = c.y > 0;
        const nearRight = x + c.w < 1;
        const nearBottom = c.y + c.h < 1;
        return (
          <View
            key={slot.id}
            style={{
              position: "absolute",
              left: pad + offsetX + Math.round(x * pageW) + (nearLeft ? gap / 2 : 0),
              top: pad + Math.round(c.y * pageH) + (nearTop ? gap / 2 : 0),
              width: Math.round(c.w * pageW) - (nearLeft ? gap / 2 : 0) - (nearRight ? gap / 2 : 0),
              height: Math.round(c.h * pageH) - (nearTop ? gap / 2 : 0) - (nearBottom ? gap / 2 : 0),
            }}
          >
            <SlotCell
              photo={photoById(photos, slot.photoId)} selected={slot.id === selectedSlotId} swap={slot.id === swapSlotId}
              dropHere={slot.id === dropTargetId} onPress={onSlotPress ? () => onSlotPress(slot.id) : undefined}
              style={styles.pageCell} hint="Фото" compact={layout.cells.length > 2}
              innerRef={registerSlot ? (v) => registerSlot(slot.id, v) : undefined}
            />
          </View>
        );
      })}
    </View>
  );
}
