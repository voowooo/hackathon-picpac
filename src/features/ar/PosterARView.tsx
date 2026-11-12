import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { DeviceMotion } from "expo-sensors";
import { useEffect, useRef } from "react";
import { Animated, Image, Modal, PanResponder, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from '../../styles/app.styles';
import { colors } from '../../styles/theme';

// ═══════════════════════════ AR: примерка постера ═══════════════════════════
// Псевдо-AR в Expo Go: живая камера + постер, «прикреплённый» к точке стены.
// ARKit/ARCore требует native-сборку, поэтому якорь считается по датчикам
// движения: интегрируем скорость поворота телефона (DeviceMotion) и сдвигаем
// постер по «фокусному расстоянию» экрана так, как сдвигалась бы стена.
// Повернётесь в сторону — постер уходит за край экрана и остаётся на стене;
// стрелка-подсказка возвращает к нему. Позиция/масштаб — в Animated-значениях:
// датчики и жесты не ре-рендерят дерево. Компонент на уровне модуля (как
// PhotoTray); камера монтируется только пока открыт Modal — активным может быть
// лишь один CameraView.
export function PosterARView({
  visible, onClose, photoUri, aspect,
}: {
  visible: boolean; onClose: () => void; photoUri?: string; aspect: number;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Стартовый размер постера: ~половина экрана, но не шире 85% ширины.
  const baseH = Math.min(height * 0.5, (width * 0.85) / aspect);
  const baseW = baseH * aspect;

  // «Фокусное расстояние» экрана при горизонтальном FOV ~60° (типично для
  // камер смартфонов): сколько пикселей соответствует углу в 1 радиан.
  // Именно по нему угол поворота переводится в сдвиг постера по экрану.
  const focal = width / (2 * Math.tan(((60 * Math.PI) / 180) / 2));

  const pos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const scale = useRef(new Animated.Value(1)).current;
  const arrowX = useRef(new Animated.Value(0)).current;
  const arrowY = useRef(new Animated.Value(0)).current;
  const arrowRot = useRef(new Animated.Value(0)).current;
  const arrowOpacity = useRef(new Animated.Value(0)).current;

  // Живое состояние: накопленные углы (yaw — влево/вправо, pitch — вверх/вниз),
  // якорь «точка на стене», ручные сдвиги пальцем и масштаб щипком.
  const live = useRef({ yaw: 0, pitch: 0, userX: 0, userY: 0, userScale: 1 });
  const anchor = useRef({ yaw: 0, pitch: 0 });
  const gesture = useRef({ mode: "none" as "none" | "pan" | "pinch", lastX: 0, lastY: 0, startScale: 1, startDist: 0, lastCount: 0 });

  const rad = (deg: number) => (deg * Math.PI) / 180;
  const clamp01 = (v: number) => Math.max(-1, Math.min(1, v));

  // Пересчитать, где постер должен быть на экране сейчас.
  // Поворот влево (gamma > 0) — стена уезжает вправо по экрану; наклон вверх
  // (beta > 0) — вниз. Ручные сдвиги пальцем добавляются поверх.
  const applyPlacement = () => {
    const { yaw, pitch, userX, userY } = live.current;
    const dx = Math.tan(rad(yaw - anchor.current.yaw)) * focal;
    const dy = Math.tan(rad(pitch - anchor.current.pitch)) * focal;
    const x = (width - baseW) / 2 + dx + userX;
    const y = (height - baseH) / 2 + dy + userY;
    pos.setValue({ x, y });
    // Стрелка: постер за краем экрана — показываем, куда повернуться.
    const ox = dx + userX;
    const oy = dy + userY;
    if (Math.abs(ox) > width / 2 || Math.abs(oy) > height / 2) {
      const edge = 46;
      arrowX.setValue(width / 2 + clamp01(ox / (width / 2)) * (width / 2 - edge) - 22);
      arrowY.setValue(height / 2 + clamp01(oy / (height / 2)) * (height / 2 - edge) - 22);
      arrowRot.setValue((Math.atan2(oy, ox) * 180) / Math.PI);
      arrowOpacity.setValue(1);
    } else {
      arrowOpacity.setValue(0);
    }
  };
  // Жесты и датчики должны вызывать актуальную версию расчёта — держим её в ref.
  const applyRef = useRef(applyPlacement);
  applyRef.current = applyPlacement;

  // Датчики движения: только пока примерка открыта.
  useEffect(() => {
    if (!visible) return;
    live.current = { yaw: 0, pitch: 0, userX: 0, userY: 0, userScale: 1 };
    anchor.current = { yaw: 0, pitch: 0 };
    scale.setValue(1);
    applyRef.current();
    DeviceMotion.setUpdateInterval(33);
    let last = 0;
    const sub = DeviceMotion.addListener((m) => {
      const rate = m.rotationRate;
      if (!rate) return;
      const now = Date.now();
      const dt = last ? Math.min(0.2, (now - last) / 1000) : 0;
      last = now;
      const l = live.current;
      // Мёртвая зона отсекает дрожь датчика, иначе постер «уплывает» на месте.
      if (Math.abs(rate.gamma) > 0.6) l.yaw += rate.gamma * dt;
      if (Math.abs(rate.beta) > 0.6) l.pitch += rate.beta * dt;
      l.pitch = Math.max(-70, Math.min(70, l.pitch));
      applyRef.current();
    });
    return () => sub.remove();
  }, [visible, scale]);

  const touchDist = (t0: { pageX: number; pageY: number }, t1: { pageX: number; pageY: number }) =>
    Math.hypot(t1.pageX - t0.pageX, t1.pageY - t0.pageY);

  const pan = useRef(
    PanResponder.create({
      // Забираем все касания постера: камера под ним не должна их обрабатывать.
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const t = e.nativeEvent.touches;
        gesture.current = {
          mode: t.length >= 2 ? "pinch" : "pan",
          lastX: t[0]?.pageX ?? 0, lastY: t[0]?.pageY ?? 0,
          startScale: live.current.userScale, startDist: 0, lastCount: t.length,
        };
      },
      onPanResponderMove: (e) => {
        const t = e.nativeEvent.touches;
        const g = gesture.current;
        if (t.length >= 2) {
          // Щипок: если только что положили второй палец — фиксируем стартовое расстояние.
          if (g.mode !== "pinch") {
            g.mode = "pinch";
            g.startScale = live.current.userScale;
            g.startDist = 0;
          }
          const d = touchDist(t[0], t[1]);
          if (g.startDist === 0) g.startDist = d;
          else if (d > 0) {
            live.current.userScale = Math.min(3, Math.max(0.3, g.startScale * (d / g.startDist)));
            scale.setValue(live.current.userScale);
          }
        } else if (t.length === 1) {
          // Пан: подвинуть постер по стене (ведём по дельте касания — после
          // щипка накопленный dx недостоверен).
          if (g.mode !== "pan" || g.lastCount !== 1) {
            g.mode = "pan";
            g.lastX = t[0].pageX;
            g.lastY = t[0].pageY;
          } else {
            const dx = t[0].pageX - g.lastX;
            const dy = t[0].pageY - g.lastY;
            g.lastX = t[0].pageX;
            g.lastY = t[0].pageY;
            live.current.userX += dx;
            live.current.userY += dy;
          }
        }
        g.lastCount = t.length;
        applyRef.current();
      },
    }),
  ).current;

  // Закрепить постер в том, что сейчас видно в камере.
  const pinHere = () => {
    anchor.current = { yaw: live.current.yaw, pitch: live.current.pitch };
    live.current.userX = 0;
    live.current.userY = 0;
    applyRef.current();
  };

  const granted = permission?.granted ?? false;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.arScreen}>
        {/* Камера живёт только пока примерка открыта: активным может быть лишь один CameraView */}
        {granted && visible ? <CameraView style={StyleSheet.absoluteFill} facing="back" /> : null}

        {!permission ? (
          <View style={styles.arGate}>
            <Ionicons name="camera-outline" size={36} color="#fff" />
            <Text style={styles.arGateText}>Проверяем доступ к камере…</Text>
          </View>
        ) : !granted ? (
          <View style={styles.arGate}>
            <Ionicons name="camera-outline" size={36} color="#fff" />
            <Text style={styles.arGateTitle}>Нужен доступ к камере</Text>
            <Text style={styles.arGateText}>
              {permission.canAskAgain
                ? "Постер накладывается на живое изображение с камеры."
                : "Доступ запрещён — включите камеру для PicPac в настройках устройства."}
            </Text>
            {permission.canAskAgain ? (
              <Pressable style={styles.arGateButton} onPress={() => void requestPermission()}>
                <Text style={styles.arGateButtonText}>Разрешить камеру</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.arGateCancel} onPress={onClose} hitSlop={8}>
              <Text style={styles.arGateCancelText}>Вернуться в редактор</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Сам постер «на стене» поверх камеры */}
        <Animated.View
          {...pan.panHandlers}
          style={[styles.arPoster, { width: baseW, height: baseH, transform: [{ translateX: pos.x }, { translateY: pos.y }, { scale }] }]}
        >
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.arPosterImage} resizeMode="cover" />
          ) : (
            <View style={styles.arPosterPlaceholder}>
              <Ionicons name="image-outline" size={40} color={colors.textSecondary} />
              <Text style={styles.arPosterPlaceholderText}>Добавьте фото в постер</Text>
            </View>
          )}
        </Animated.View>

        {/* Стрелка: постер за краем экрана — повернитесь к нему */}
        <Animated.View
          pointerEvents="none"
          style={[styles.arArrow, {
            transform: [
              { translateX: arrowX },
              { translateY: arrowY },
              { rotate: arrowRot.interpolate({ inputRange: [-180, 180], outputRange: ["-180deg", "180deg"] }) },
            ],
            opacity: arrowOpacity,
          }]}
        >
          <Ionicons name="arrow-forward" size={22} color="#fff" />
        </Animated.View>

        {/* Верхняя панель: выход */}
        <View style={[styles.arTopBar, { top: insets.top + 12 }]}>
          <Pressable style={styles.arCircleBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Закрыть AR-примерку" hitSlop={8}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
        </View>

        {/* Нижняя панель: подсказка и «закрепить здесь» */}
        <View style={[styles.arBottomBar, { bottom: insets.bottom + 16 }]} pointerEvents="box-none">
          <Text style={styles.arHint}>Постер на стене — оглядывайтесь · щипок — размер</Text>
          <Pressable style={styles.arResetBtn} onPress={pinHere} accessibilityRole="button" accessibilityLabel="Закрепить постер в текущем положении" hitSlop={8}>
            <Ionicons name="pin" size={16} color="#fff" />
            <Text style={styles.arResetText}>Закрепить здесь</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
