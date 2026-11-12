import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import type { Action } from "expo-image-manipulator";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PhotoMenuTransition } from '../../components/animation/PhotoMenuTransition';
import { styles } from '../../styles/app.styles';
import { colors } from '../../styles/theme';
import { IconName, Photo, PhotoEdit, PhotoProcessingUpdate, PhotoQuality } from '../../types/index';
import { analyzePhoto, findSmartCrop, prepareEditorWorkingImage, processLocalPhoto } from '../smart-tools/service';
import type { LocalEffect } from '../smart-tools/pixels';
import { SmartToolsPanel } from '../smart-tools/SmartToolsPanel';
import { clamp } from '../../utils/format';
import { cropToPixels, fitCropToAspect, normalizedToDisplayCrop } from "./crop";

type Source = { uri: string; w: number; h: number };
type UndoState = { src: Source; base: string | null | undefined; rotate: number; crop: { x: number; y: number; w: number; h: number }; quality?: PhotoQuality };

export function PhotoEditorModal({
  photo, targetRatio, onClose, onApply, toast: notifyApp,
}: {
  photo?: Photo | null; onClose: () => void;
  targetRatio: number;
  onApply: (photoId: string, uri: string, edit: PhotoEdit, update?: PhotoProcessingUpdate) => void;
  toast: (text: string, icon?: IconName) => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const boxW = Math.min(width - 48, 420);
  const boxH = Math.round(Math.min(boxW * 1.15, height * .40));
  const [rotate, setRotate] = useState(0);
  const [mode, setMode] = useState<"view" | "crop">("view");
  const [src, setSrc] = useState<{ uri: string; w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const toast = (text: string, icon?: IconName) => { setFeedback(text); notifyApp(text, icon); };
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 6000);
    return () => clearTimeout(timer);
  }, [feedback]);
  const processing = useRef(false);
  const [workingBase, setWorkingBase] = useState<string | null | undefined>();
  const [quality, setQuality] = useState<PhotoQuality>();
  const [lightweight, setLightweight] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [history, setHistory] = useState<UndoState[]>([]);
  const pendingCrop = useRef<UndoState | null>(null);
  const [rotating, setRotating] = useState(false);
  const [entrance] = useState(() => new Animated.Value(0));
  const closing = useRef(false);
  const [geometry] = useState(() => ({
    w: new Animated.Value(0), h: new Animated.Value(0),
    x: new Animated.Value(0), y: new Animated.Value(0),
    cw: new Animated.Value(0), ch: new Animated.Value(0),
    mask: new Animated.Value(1),
  }));
  // Область обрезки — в пикселях отображаемого (повёрнутого) изображения.
  // Пропорция рамки равна области фото в макете.
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 0, h: 0 });
  // Плавный поворот: аккумулируем 90° шаги, чтобы анимация всегда крутилась вперёд.
  const [rotAnim] = useState(() => new Animated.Value(0));
  const [scaleAnim] = useState(() => new Animated.Value(1));
  const [gesture] = useState(() => ({
    kind: "none" as "none" | "move" | "resize",
    x: 0, y: 0, crop: { x: 0, y: 0, w: 0, h: 0 },
    pinch0: 0, crop0: { x: 0, y: 0, w: 0, h: 0 },
  }));

  // Зеркала для обработчиков PanResponder (создаётся один раз — берём актуальные значения из ref).
  const cropRef = useRef(crop);
  useEffect(() => { cropRef.current = crop; }, [crop]);
  const dispRef = useRef({ w: 0, h: 0 });

  const rot = ((rotate % 360) + 360) % 360;
  const quarter = rot === 90 || rot === 270;
  const nat = src ? (quarter ? { w: src.h, h: src.w } : src) : null;
  const k = nat ? Math.min(boxW / nat.w, boxH / nat.h) : 1;
  const dispW = nat ? nat.w * k : 0;
  const dispH = nat ? nat.h * k : 0;
  const baseK = src ? Math.min(boxW / src.w, boxH / src.h) : 1;
  // Orientation belongs to the layout cell, even when the source photo is landscape.
  const ratio = targetRatio;
  useEffect(() => { dispRef.current = { w: dispW, h: dispH }; }, [dispW, dispH]);

  useEffect(() => {
    let cancelled = false;
    if (photo) {
      setRotate(photo.edit?.rotation ?? 0); setMode("view"); setSrc(null); setBusy(false); setRotating(false);
      setWorkingBase(undefined); setQuality(photo.quality); setLightweight(false); setHistory([]); setFeedback(null); processing.current = false; pendingCrop.current = null;
      setCrop({ x: 0, y: 0, w: 0, h: 0 });
      rotAnim.setValue(photo.edit?.rotation ?? 0);
      scaleAnim.setValue(1);
      closing.current = false;
      entrance.setValue(0);
      Animated.timing(entrance, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      // Decode once through the same library used to apply edits. This bakes
      // EXIF orientation and gives full pixel dimensions, including on iOS.
      void prepareEditorWorkingImage(
        photo.processingBaseUri ?? photo.originalUri ?? photo.uri,
        photo.width,
        photo.height,
      )
        .then((image) => {
          if (!cancelled) {
            const origPixels = (photo.width ?? image.width) * (photo.height ?? image.height);
            setLightweight(origPixels > 8_000_000);
            setPreviewKey(k => k + 1);
            setSrc({ uri: image.uri, w: image.width, h: image.height });
          }
        })
        .catch(() => {
          if (!cancelled) toast("Не удалось открыть фото", "warning-outline");
        });
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo?.id]);

  const closeEditor = () => {
    if (closing.current || busy) return;
    closing.current = true;
    Animated.timing(entrance, { toValue: 0, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
      if (finished) onClose();
    });
  };

  useEffect(() => {
    const values: [Animated.Value, number][] = [
      [rotAnim, rotate], [scaleAnim, k / baseK],
      [geometry.w, dispW], [geometry.h, dispH],
      [geometry.x, crop.x], [geometry.y, crop.y],
      [geometry.cw, crop.w], [geometry.ch, crop.h],
    ];
    if (!rotating) {
      values.forEach(([value, target]) => value.setValue(target));
      Animated.timing(geometry.mask, { toValue: 1, duration: 160, useNativeDriver: false }).start();
      return;
    }
    // One clock for image bounds, rotation and crop frame; hide shading while
    // the photo crosses intermediate angles so it never forms black wedges.
    geometry.mask.stopAnimation();
    geometry.mask.setValue(0);
    const animation = Animated.parallel(values.map(([value, toValue]) =>
      Animated.timing(value, { toValue, duration: 380, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
    ));
    animation.start(({ finished }) => {
      if (finished) {
        setRotating(false);
      }
    });
    return () => animation.stop();
  }, [rotate, rotAnim, scaleAnim, k, baseK, dispW, dispH, crop, geometry, rotating]);

  useEffect(() => {
    if (!src || !photo) return;
    if (pendingCrop.current) {
      setCrop(pendingCrop.current.crop); pendingCrop.current = null; return;
    }
    const edit = workingBase === undefined ? photo.edit : undefined;
    const savedRotation = edit?.rotation ?? 0;
    const swapped = savedRotation === 90 || savedRotation === 270;
    const w = swapped ? src.h : src.w;
    const h = swapped ? src.w : src.h;
    const fit = Math.min(boxW / w, boxH / h);
    const displayW = w * fit;
    const displayH = h * fit;
    const c = edit?.crop;
    const bounds = c
      ? { x: c.x * displayW, y: c.y * displayH, w: c.w * displayW, h: c.h * displayH }
      : { x: 0, y: 0, w: displayW, h: displayH };
    setCrop(fitCropToAspect(bounds, ratio));
    // Upload quality can finish while the editor is open; it must not reset the crop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, photo?.id, boxW, boxH, ratio, workingBase]);

  const centerCrop = (w: number, h: number, aspect = ratio) => {
    setCrop(fitCropToAspect({ x: 0, y: 0, w, h }, aspect));
  };

  const doRotate = () => {
    if (!src || rotating || busy) return;
    const next = (rot + 90) % 360;
    setRotating(true);
    setRotate((value) => value + 90);
    // В режиме обрезки рамку пересобираем под новые пропорции отображения.
    if (src) {
      const n = next === 90 || next === 270 ? { w: src.h, h: src.w } : src;
      const kk = Math.min(boxW / n.w, boxH / n.h);
      centerCrop(n.w * kk, n.h * kk);
    }
  };

  const [cropPan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        const c = cropRef.current;
        // Тап у правого нижнего угла рамки — изменение размера, внутри — перенос.
        gesture.kind = Math.abs(locationX - (c.x + c.w)) < 40 && Math.abs(locationY - (c.y + c.h)) < 40 ? "resize" : "move";
        gesture.x = locationX;
        gesture.y = locationY;
        gesture.crop = { ...c };
        gesture.pinch0 = 0;
      },
      onPanResponderMove: (e) => {
        const { w: dw, h: dh } = dispRef.current;
        const touches = e.nativeEvent.touches;
        // Щипок двумя пальцами — изменение размера рамки вокруг её центра.
        if (touches.length >= 2) {
          const d = Math.hypot(touches[1].pageX - touches[0].pageX, touches[1].pageY - touches[0].pageY);
          if (gesture.pinch0 <= 0) { gesture.pinch0 = d; gesture.crop0 = { ...cropRef.current }; return; }
          const c0 = gesture.crop0;
          const cx = c0.x + c0.w / 2;
          const cy = c0.y + c0.h / 2;
          const s = clamp(d / gesture.pinch0, 0.2, 3);
          const aspect = c0.w / c0.h;
          const maxW = Math.min(dw, dh * aspect);
          const w = clamp(c0.w * s, Math.min(48, maxW), maxW);
          const h = w / aspect;
          setCrop({ x: clamp(cx - w / 2, 0, dw - w), y: clamp(cy - h / 2, 0, dh - h), w, h });
          return;
        }
        gesture.pinch0 = 0;
        if (gesture.kind === "none") return;
        const { locationX, locationY } = e.nativeEvent;
        const dx = locationX - gesture.x;
        const dy = locationY - gesture.y;
        const c = gesture.crop;
        if (gesture.kind === "move") {
          setCrop({ x: clamp(c.x + dx, 0, dw - c.w), y: clamp(c.y + dy, 0, dh - c.h), w: c.w, h: c.h });
        } else {
          const aspect = c.w / c.h;
          const maxW = Math.min(dw - c.x, (dh - c.y) * aspect);
          const delta = (dx + dy * aspect) / 2;
          const w = clamp(c.w + delta, Math.min(48, maxW), maxW);
          setCrop({ x: c.x, y: c.y, w, h: w / aspect });
        }
      },
      onPanResponderRelease: () => { gesture.kind = "none"; gesture.pinch0 = 0; },
    }),
  );

  const renderCurrent = async () => {
    if (!src || !nat || crop.w <= 0 || crop.h <= 0) throw new Error('Фото ещё не готово');
    const actions: Action[] = [];
    if (rot) actions.push({ rotate: rot });
    const pixels = cropToPixels(crop, { w: dispW, h: dispH }, nat);
    actions.push({ crop: pixels });
    return manipulateAsync(src.uri, actions, { compress: 1, format: SaveFormat.PNG });
  };

  const remember = () => {
    if (src) setHistory(prev => [...prev.slice(-2), { src, base: workingBase, rotate, crop, quality }]);
  };
  const runTool = async (tool: LocalEffect | 'crop') => {
    if (!src || !nat || busy || rotating || processing.current) return;
    processing.current = true; setBusy(true);
    try {
      if (tool === 'crop') {
        const suggested = await findSmartCrop(src.uri, src.w, src.h, ratio, rot);
        const proposed = fitCropToAspect(normalizedToDisplayCrop(suggested, dispW, dispH), ratio);
        const similar = Math.hypot(proposed.x - crop.x, proposed.y - crop.y) < 6
          && Math.hypot(proposed.w - crop.w, proposed.h - crop.h) < 6;
        remember();
        if (!similar) setCrop(proposed);
        setMode('crop');
      } else {
        // Process the full rotated source, keeping the editable area outside the
        // crop. Only the final OK bakes the crop into the print image.
        const result = await processLocalPhoto(src.uri, src.w, src.h, tool, lightweight, rot);
        if (result.mocked) { toast('Демо-режим: фото оставлено без изменений', 'information-circle-outline'); return; }
        const measured = await analyzePhoto(result).catch(() => undefined);
        remember();
        const oldDispW = dispW, oldDispH = dispH;
        const nextK = Math.min(boxW / result.width, boxH / result.height);
        const nextDispW = result.width * nextK, nextDispH = result.height * nextK;
        const nextCrop = oldDispW > 0 && oldDispH > 0
          ? {
            x: crop.x * nextDispW / oldDispW,
            y: crop.y * nextDispH / oldDispH,
            w: crop.w * nextDispW / oldDispW,
            h: crop.h * nextDispH / oldDispH,
          }
          : crop;
        pendingCrop.current = { src: { uri: src.uri, w: src.w, h: src.h }, base: workingBase, rotate: 0, crop: nextCrop, quality: measured };
        setWorkingBase(result.uri); setRotate(0); rotAnim.setValue(0); scaleAnim.setValue(1);
        setPreviewKey(k => k + 1);
        setSrc({ uri: result.uri, w: result.width, h: result.height }); setQuality(measured);
        if (result.downscaled && lightweight) setLightweight(true);
      }
    } catch {
      toast('Не получилось применить эффект — попробуйте ещё раз или отмените последний шаг', 'warning-outline');
    } finally { processing.current = false; setBusy(false); }
  };
  const undo = () => {
    const previous = history[history.length - 1];
    if (!previous || busy) return;
    pendingCrop.current = previous;
    setPreviewKey(k => k + 1);
    setSrc({ ...previous.src }); setWorkingBase(previous.base); setRotate(previous.rotate);
    setCrop(previous.crop); setQuality(previous.quality); setHistory(prev => prev.slice(0, -1));
  };
  const resetOriginal = async () => {
    if (!photo || busy || processing.current) return;
    processing.current = true; setBusy(true);
    try {
      const result = await prepareEditorWorkingImage(photo.originalUri ?? photo.uri, photo.width, photo.height);
      const measured = await analyzePhoto(result).catch(() => undefined);
      remember(); setWorkingBase(null); setRotate(0); setPreviewKey(k => k + 1);
      setSrc({ uri: result.uri, w: result.width, h: result.height }); setQuality(measured);
    } catch { toast('Не удалось открыть оригинал', 'warning-outline'); }
    finally { processing.current = false; setBusy(false); }
  };

  const save = async () => {
    if (!photo || !src || !nat || busy || rotating || crop.w <= 0 || crop.h <= 0) return;
    setBusy(true);
    try {
      const pixels = cropToPixels(crop, { w: dispW, h: dispH }, nat);
      const result = await renderCurrent();
      const measured = await analyzePhoto(result).catch(() => undefined);
      onApply(photo.id, result.uri, { rotation: rot, crop: { x: pixels.originX / nat.w, y: pixels.originY / nat.h, w: pixels.width / nat.w, h: pixels.height / nat.h } }, { processingBaseUri: workingBase, width: result.width, height: result.height, quality: measured });
      toast("Фото обновлено");
      onClose();
    } catch {
      toast("Не удалось изменить фото", "warning-outline");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={!!photo} transparent animationType="none" statusBarTranslucent onRequestClose={closeEditor}>
      <Animated.View style={[styles.peScreen, { opacity: entrance, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
        {/* Фон: размытие того, что за редактором + затемняющий слой для контраста */}
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={[StyleSheet.absoluteFill, styles.peBackdrop]} pointerEvents="none" />
        <Animated.View style={[styles.peTop, { transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
          <Pressable onPress={closeEditor} hitSlop={10} accessibilityRole="button" accessibilityLabel="Закрыть редактор фото">
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
          <Text style={styles.peTitle}>Редактор фото</Text>
          <View style={{ width: 26 }} />
        </Animated.View>

        <View style={[styles.peBox, { width: boxW, height: boxH }]}>
          {photo ? (
            src ? (
              <Animated.View style={{ width: geometry.w, height: geometry.h, alignItems: "center", justifyContent: "center" }}>
                {/* Размер исходника постоянен, поворот и масштаб анимируются вместе. */}
                <Animated.Image
                  key={`${src.uri}-${previewKey}`}
                  source={{ uri: src.uri }}
                  style={{ width: src.w * baseK, height: src.h * baseK, transform: [{ rotate: rotAnim.interpolate({ inputRange: [0, 360], outputRange: ["0deg", "360deg"] }) }, { scale: scaleAnim }] }}
                  resizeMode="cover"
                />
                {crop.w > 0 ? (
                  <View style={StyleSheet.absoluteFill} pointerEvents={mode === "crop" && !rotating ? "auto" : "none"} {...cropPan.panHandlers}>
                    {/* Дети — pointerEvents none: касания всегда считает сама рамка-слой,
                        иначе locationX «прыгает» при попадании на белый прямоугольник */}
                    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                      <Animated.View style={[styles.peMaskAbs, { opacity: geometry.mask, left: 0, right: 0, top: 0, height: geometry.y }]} />
                      <Animated.View style={[styles.peMaskAbs, { opacity: geometry.mask, left: 0, width: geometry.x, top: geometry.y, height: geometry.ch }]} />
                      <Animated.View style={[styles.peMaskAbs, { opacity: geometry.mask, right: 0, left: Animated.add(geometry.x, geometry.cw), top: geometry.y, height: geometry.ch }]} />
                      <Animated.View style={[styles.peMaskAbs, { opacity: geometry.mask, left: 0, right: 0, top: Animated.add(geometry.y, geometry.ch), bottom: 0 }]} />
                      <Animated.View style={[styles.peCropRect, { left: geometry.x, top: geometry.y, width: geometry.cw, height: geometry.ch }]}>
                        {mode === "crop" ? <View style={styles.peCropHandle} /> : null}
                      </Animated.View>
                    </View>
                  </View>
                ) : null}
              </Animated.View>
            ) : (
              <ActivityIndicator color={colors.bg} size="large" />
            )
          ) : null}
          {busy ? <ActivityIndicator style={StyleSheet.absoluteFill} color="#fff" size="large" /> : null}
        </View>

        <ScrollView style={{ flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' }} contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
        {(busy || feedback) && <Text accessibilityLiveRegion="polite" style={[styles.peHint, { marginTop: 8 }]}>{busy ? 'Обрабатываем на устройстве…' : feedback}</Text>}
        {photo ? (
          mode === "crop" ? (
            <PhotoMenuTransition key="crop" style={styles.peControls}>
              <Text style={styles.peHint}>Перемещайте рамку. Красный маркер меняет размер с сохранением пропорций.</Text>
              <View style={styles.peRow}>
                <Pressable style={styles.peBtn} onPress={() => setMode("view")} hitSlop={6} accessibilityRole="button">
                  <Ionicons name="close" size={18} color="#fff" />
                  <Text style={styles.peBtnText}>Отмена</Text>
                </Pressable>
                <Pressable style={[styles.peBtn, styles.peBtnPrimary]} onPress={() => void save()} disabled={busy} hitSlop={6} accessibilityRole="button">
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={styles.peBtnText}>Обрезать</Text>
                </Pressable>
              </View>
            </PhotoMenuTransition>
          ) : (
            <PhotoMenuTransition key="view" style={styles.peControls}>
              <View style={styles.peRow}>
                <Pressable style={styles.peBtn} disabled={!src || rotating || busy} onPress={doRotate} hitSlop={6} accessibilityRole="button" accessibilityLabel="Повернуть на 90 градусов">
                  <Ionicons name="refresh-outline" size={18} color="#fff" />
                  <Text style={styles.peBtnText}>Повернуть</Text>
                </Pressable>
                <Pressable style={styles.peBtn} disabled={!src || rotating || busy} onPress={() => setMode("crop")} hitSlop={6} accessibilityRole="button" accessibilityLabel="Обрезать фото">
                  <Ionicons name="crop-outline" size={18} color="#fff" />
                  <Text style={styles.peBtnText}>Обрезать</Text>
                </Pressable>
                {src ? (
                  <Pressable style={[styles.peBtn, styles.peBtnPrimary]} onPress={() => void save()} disabled={busy || rotating} hitSlop={6} accessibilityRole="button" accessibilityLabel="Сохранить фото">
                    <Ionicons name="checkmark" size={18} color="#fff" />
                    <Text style={styles.peBtnText}>ОК</Text>
                  </Pressable>
                ) : null}
              </View>
              <SmartToolsPanel quality={quality ?? photo.quality} disabled={!src || busy || rotating} canUndo={history.length > 0} onTool={tool => void runTool(tool)} onUndo={undo} onReset={() => void resetOriginal()} large={!!src && src.w * src.h > 8_000_000} lightweight={lightweight} onLightweight={() => setLightweight(value => !value)} />
            </PhotoMenuTransition>
          )
        ) : null}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}
