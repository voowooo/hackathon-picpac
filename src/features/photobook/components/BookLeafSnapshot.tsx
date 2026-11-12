import React from "react";
import { Text, View } from "react-native";
import { styles } from '../../../styles/app.styles';
import { Photo, ProductConfig } from '../../../types/index';
import type { BookLeaf } from "../turn";
import { BookCoverFlat } from './BookCoverFlat';
import { SpreadPageHalf } from './SpreadPageHalf';

// Render exactly one physical page. No full-spread copies, interaction handlers,
// selection state or drop-target refs participate in the turn animation.
export const BookLeafSnapshot = React.memo(function BookLeafSnapshot({ leaf, cfg, photos, width, height }: {
  leaf: BookLeaf; cfg: ProductConfig; photos: Photo[]; width: number; height: number;
}) {
  if (leaf.page === 0) return (
    <BookCoverFlat cfg={cfg} photos={photos} width={width} height={height} bookPage={0} onBookPage={() => { }} />
  );
  const geometry = { pad: 10, gap: 4, pageW: width - 10, pageH: height - 20 };
  return (
    <View style={{ width, height, overflow: "hidden", backgroundColor: "#fffdfa" }}>
      <View style={{ position: "absolute", top: 0, left: leaf.side === "left" ? 0 : -width, width: width * 2, height }}>
        <SpreadPageHalf cfg={cfg} photos={photos} page={leaf.page} side={leaf.side} geometry={geometry} />
      </View>
      <Text style={[styles.spreadNum, leaf.side === "left" ? { left: 12 } : { right: 12 }]}>{leaf.page * 2 + (leaf.side === "right" ? 1 : 0)}</Text>
    </View>
  );
});
