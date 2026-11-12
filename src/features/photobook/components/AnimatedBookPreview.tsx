import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, Text, useWindowDimensions, View } from "react-native";
import { photoById } from '../../../domain/photos';
import { spreadLayoutOf, spreadSlotsFor } from '../../../domain/products';
import { NATIVE } from '../../../services/platform';
import { styles } from '../../../styles/app.styles';
import { colors } from '../../../styles/theme';
import { FlatPreviewProps, Photo, ProductConfig } from '../../../types/index';
import { clamp, parseRatio } from '../../../utils/format';
import { BookImageReadyScope } from '../../photos/components/PhotoSlot';
import { bookTurnPlan } from "../turn";
import { BookCoverFlat } from './BookCoverFlat';
import { BookLeafSnapshot } from './BookLeafSnapshot';
import { BookSpreadView } from './BookSpreadView';

export function AnimatedBookPreview(props: FlatPreviewProps) {
  const { cfg, photos, bookPage, onBookPage, selectedSlotId, swapSlotId, onSlotPress, registerSlot, dropTargetId, onTextPress } = props;
  const { width } = useWindowDimensions();
  const w = Math.round(Math.min(width - 40, 480));
  const h = Math.round(w / (2 * parseRatio(cfg.bookFormat)));
  const half = w / 2;
  const page = clamp(bookPage, 0, cfg.spreads);
  const [turn, setTurn] = useState<{ from: number; to: number; cfg: ProductConfig; photos: Photo[] } | null>(null);
  const [progress] = useState(() => new Animated.Value(0));
  const [buffers, setBuffers] = useState<[number | null, number | null]>([page, null]);
  const [activeBuffer, setActiveBuffer] = useState(0);
  const [prepared, setPrepared] = useState(false);
  const pendingImages = useRef(new Set<string>());
  const loadedImages = useRef(new Set<string>());
  const imageReady = useCallback((key: string) => {
    loadedImages.current.add(key);
    if (pendingImages.current.delete(key) && pendingImages.current.size === 0) setPrepared(true);
  }, []);
  const turning = useRef(false);
  useEffect(() => {
    if (!turn || !prepared) return;
    const animation = Animated.timing(progress, {
      toValue: 1, duration: turn.from === 0 || turn.to === 0 ? 850 : 680,
      easing: Easing.inOut(Easing.cubic), useNativeDriver: NATIVE,
    });
    // Give the fixed page layers two frames to finish layout before moving them.
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        animation.start(({ finished }) => {
          if (!finished) return;
          onBookPage(turn.to);
          setActiveBuffer((value) => 1 - value);
          setTurn(null);
          turning.current = false;
        });
      });
    });
    return () => { cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame); animation.stop(); };
  }, [turn, prepared, progress, onBookPage]);

  const go = (target: number) => {
    if (turning.current || target === page || target < 0 || target > cfg.spreads) return;
    turning.current = true;
    progress.setValue(0);
    const nextBuffer = 1 - activeBuffer;
    const plan = bookTurnPlan(page, target);
    const uris = (n: number, side?: "left" | "right") => {
      if (n === 0) return [photoById(photos, cfg.slots[0]?.photoId)?.uri].filter((uri): uri is string => !!uri);
      const layout = spreadLayoutOf(cfg, n);
      return spreadSlotsFor(cfg, n).flatMap((slot, index) => {
        const cell = layout.cells[index];
        if (side && (side === "left" ? cell.x >= 1 : cell.x < 1)) return [];
        const photo = photoById(photos, slot.photoId);
        return photo ? [photo.uri] : [];
      });
    };
    const keys = [...uris(target).map((uri) => `live-${nextBuffer}:${uri}`)];
    for (const leaf of [...plan.stationary, plan.front, plan.back]) {
      if (leaf) keys.push(...uris(leaf.page, leaf.side).map((uri) => `leaf-${leaf.page}-${leaf.side}:${uri}`));
    }
    pendingImages.current = new Set(keys.filter((key) => !(buffers[nextBuffer] === target && key.startsWith(`live-${nextBuffer}:`) && loadedImages.current.has(key))));
    setPrepared(pendingImages.current.size === 0);
    setBuffers(activeBuffer === 0 ? [page, target] : [target, page]);
    setTurn({ from: page, to: target, cfg, photos });
  };
  // Only the resting, interactive book registers drop targets. Animation copies
  // never overwrite the actual cell refs used by drag and photo cropping.
  const renderPage = (n: number, interactive: boolean, coverAtRight = false) => n === 0 ? (
    <View style={{ width: w, height: h, alignItems: coverAtRight ? "flex-end" : "center" }}>
      <BookCoverFlat
        {...props} width={half} height={h} bookPage={n}
        onBookPage={go} registerSlot={interactive ? registerSlot : undefined}
        onSlotPress={interactive ? onSlotPress : undefined} onTextPress={interactive ? onTextPress : undefined}
        selectedSlotId={interactive ? selectedSlotId : null} swapSlotId={interactive ? swapSlotId : null}
        dropTargetId={interactive ? dropTargetId : null}
      />
    </View>
  ) : (
    <BookSpreadView
      cfg={cfg} photos={photos} page={n} onPage={go} width={w}
      registerSlot={interactive ? registerSlot : undefined} onSlotPress={interactive ? onSlotPress : undefined}
      selectedSlotId={interactive ? selectedSlotId : null} swapSlotId={interactive ? swapSlotId : null}
      dropTargetId={interactive ? dropTargetId : null}
    />
  );
  const plan = turn ? bookTurnPlan(turn.from, turn.to) : null;
  const shadowOpacity = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.28, 0] });
  const foldOpacity = turn?.from === 0
    ? progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.6, 1] })
    : turn?.to === 0 ? progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.6, 0] }) : 1;
  const sceneShift = turn ? progress.interpolate({
    inputRange: [0, 1], outputRange: [turn.from === 0 ? -w / 4 : 0, turn.to === 0 ? -w / 4 : 0],
  }) : 0;

  return (
    <View style={[styles.flatStage, styles.bookPreviewStage]}>
      <View style={{ width: w, height: h + 12, justifyContent: "center" }}>
        {buffers.map((bufferPage, index) => {
          const n = index === activeBuffer ? page : bufferPage;
          if (n === null) return null;
          const visible = index === activeBuffer && !(turn && prepared);
          return (
            <View key={index} pointerEvents={visible && !turn ? "auto" : "none"} accessibilityElementsHidden={!visible || !!turn} importantForAccessibility={!visible || turn ? "no-hide-descendants" : "auto"} style={{ position: "absolute", top: 6, left: 0, width: w, height: h, opacity: visible ? 1 : 0 }}>
              <BookImageReadyScope scope={`live-${index}`} onReady={imageReady}>{renderPage(n, visible && !turn)}</BookImageReadyScope>
            </View>
          );
        })}
        {turn ? (
          <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: w, height: h, opacity: prepared ? 1 : 0, transform: [{ translateX: sceneShift }] }}>
            {plan?.stationary.map((leaf) => (
              <View key={`${leaf.page}-${leaf.side}`} style={{ position: "absolute", top: 0, left: leaf.side === "left" ? 0 : half, width: half, height: h }}>
                <BookImageReadyScope scope={`leaf-${leaf.page}-${leaf.side}`} onReady={imageReady}><BookLeafSnapshot leaf={leaf} cfg={turn.cfg} photos={turn.photos} width={half} height={h} /></BookImageReadyScope>
              </View>
            ))}
            {plan?.front ? (
              <Animated.View style={{
                position: "absolute", top: 0, left: plan.front.side === "right" ? half : 0, width: half, height: h,
                transformOrigin: plan.front.side === "right" ? "left center" : "right center",
                opacity: progress.interpolate({ inputRange: [0, 0.499, 0.5, 1], outputRange: [1, 1, 0, 0], extrapolate: "clamp" }),
                transform: [{ perspective: 1100 }, { rotateY: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["0deg", plan.forward ? "-90deg" : "90deg", plan.forward ? "-90deg" : "90deg"] }) }],
              }}>
                <View renderToHardwareTextureAndroid shouldRasterizeIOS style={{ width: half, height: h }}>
                  <BookImageReadyScope scope={`leaf-${plan.front.page}-${plan.front.side}`} onReady={imageReady}><BookLeafSnapshot leaf={plan.front} cfg={turn.cfg} photos={turn.photos} width={half} height={h} /></BookImageReadyScope>
                </View>
                <Animated.View style={[styles.bookTurnShade, { opacity: shadowOpacity }]} />
              </Animated.View>
            ) : null}
            {plan?.back ? (
              <Animated.View style={{
                position: "absolute", top: 0, left: plan.back.side === "left" ? 0 : half, width: half, height: h,
                transformOrigin: plan.back.side === "left" ? "right center" : "left center",
                opacity: progress.interpolate({ inputRange: [0, 0.5, 0.501, 1], outputRange: [0, 0, 1, 1], extrapolate: "clamp" }),
                transform: [{ perspective: 1100 }, { rotateY: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [plan.forward ? "90deg" : "-90deg", plan.forward ? "90deg" : "-90deg", "0deg"] }) }],
              }}>
                <View renderToHardwareTextureAndroid shouldRasterizeIOS style={{ width: half, height: h }}>
                  <BookImageReadyScope scope={`leaf-${plan.back.page}-${plan.back.side}`} onReady={imageReady}><BookLeafSnapshot leaf={plan.back} cfg={turn.cfg} photos={turn.photos} width={half} height={h} /></BookImageReadyScope>
                </View>
                <Animated.View style={[styles.bookTurnShade, { opacity: shadowOpacity }]} />
              </Animated.View>
            ) : null}
          </Animated.View>
        ) : null}
        {/* One persistent fold for both resting pages and the entire turn. */}
        <Animated.View testID="book-fold-shadow" pointerEvents="none" style={{
          position: "absolute", top: 6, left: half - 10, width: 20, height: h, zIndex: 20,
          opacity: turn && prepared ? foldOpacity : page > 0 ? 1 : 0,
          transform: [{ translateX: turn && prepared ? sceneShift : 0 }],
        }}>
          <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.14)", "rgba(0,0,0,0)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.fill} />
        </Animated.View>
      </View>
      <View style={styles.flatNav}>
        <Pressable accessibilityRole="button" accessibilityLabel="Предыдущая страница" disabled={page === 0 || !!turn} onPress={() => go(page - 1)} style={styles.bookArrow}>
          <Ionicons name="chevron-back" size={21} color={page === 0 || turn ? colors.border : colors.text} />
        </Pressable>
        <View style={{ alignItems: "center", gap: 3 }} accessibilityLiveRegion="polite">
          <Text style={styles.flatNavLabel}>{page === 0 ? "Обложка" : `Разворот ${page} из ${cfg.spreads}`}</Text>
          <Text style={styles.bookPreviewHint}>{page === 0 ? "Откройте свою историю" : "Листайте свайпом или стрелками"}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={page === 0 ? "Открыть книгу" : "Следующая страница"} disabled={page >= cfg.spreads || !!turn} onPress={() => go(page + 1)} style={styles.bookArrow}>
          <Ionicons name="chevron-forward" size={21} color={page >= cfg.spreads || turn ? colors.border : colors.text} />
        </Pressable>
      </View>
    </View>
  );
}
