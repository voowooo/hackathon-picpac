import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { Animated, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MotionView } from '../components/animation/MotionView';
import { ScalePressable } from '../components/animation/ScalePressable';
import { Toast } from '../components/feedback/index';
import { BottomNav } from '../components/navigation/index';
import { Overlay } from '../components/overlays/Overlay';
import { PrintTextEditor } from '../components/overlays/PrintTextEditor';
import { PrimaryButton } from '../components/ui/index';
import { HINT_TO_CATEGORY, MAX_SPREADS, PRODUCT_TABS, SCENARIOS } from '../config/catalog';
import { photoById } from '../domain/photos';
import { PosterARView } from '../features/ar/PosterARView';
import { AIStudioPanel } from '../features/editor/panels/AIStudioPanel';
import { SettingsPanel } from '../features/editor/panels/SettingsPanel';
import { PhotoEditorModal } from '../features/photo-editor/PhotoEditorModal';
import { ExpoAr, arCapabilities } from '../services/ar';
import { usePicPac } from '../state/PicPacProvider';
import { styles } from '../styles/app.styles';
import { PASTELS, PASTEL_INK, colors, spacing } from '../styles/theme';

export function PicPacShell({ children }: { children: React.ReactNode }) {
  const controller = usePicPac();
  const { applyPhotoEdit, arNotice, arOpen, arPhase, arPinchResponder, arPosterPos, arPosterSize, arRef, arTracking, autoArrange, autoArrangeByLocation, cfg, clearArAnchors, dragPhoto, editingPhoto, editorPanel, editorRatio, ghostPos, handleArAnchors, handleArProjection, handleArTap, insets, panelContent, panelTitle, photos, pickMore, posterAspect, screen, setArNotice, setArOpen, setArTracking, setEditingPhotoId, setEditorPanel, setScenarioTitle, setScreen, setSelectedOrderId, setTextDraft, setTextEditing, showToast, slideDir, startFlow, switchCategory, textDraft, textEditing, textField, toast, unusedPhotos, updateCfg } = controller;

  const mainTab = screen === "home" || screen === "orders" || screen === "profile" ? screen : null;
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <Overlay visible={editorPanel !== null} onClose={() => setEditorPanel(null)} label="Закрыть панель" style={[styles.sheetCard, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.sheetGrabber} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{panelTitle}</Text>
          <ScalePressable accessibilityRole="button" accessibilityLabel="Закрыть панель" onPress={() => setEditorPanel(null)} scaleTo={0.88} style={styles.sheetClose}>
            <Ionicons name="close" size={22} color={colors.text} />
          </ScalePressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
          <MotionView key={panelContent} kind="section">
            {panelContent === "products" && (
              <>
                {PRODUCT_TABS.map((product, i) => (
                  <ScalePressable
                    key={product.id} accessibilityRole="button"
                    onPress={() => {
                      if (screen === "home") void startFlow(product.id);
                      else { setEditorPanel(null); switchCategory(product.id); }
                    }}
                    scaleTo={0.98} style={styles.catalogProduct}
                  >
                    <View style={[styles.catalogProductIcon, { backgroundColor: PASTELS[i % PASTELS.length] }]}>
                      <Ionicons name={product.icon} size={25} color={PASTEL_INK[i % PASTEL_INK.length]} />
                    </View>
                    <View style={styles.optionBody}>
                      <Text style={styles.settingsTitle}>{product.label}</Text>
                      <Text style={styles.settingsSummary}>{product.blurb} · {product.from}</Text>
                    </View>
                    <Ionicons name={screen !== "home" && cfg.category === product.id ? "checkmark" : "chevron-forward"} size={18} color={colors.accent} />
                  </ScalePressable>
                ))}
                <Text style={styles.sheetSectionTitle}>Идеи для подарка</Text>
                {SCENARIOS.map((scenario) => (
                  <ScalePressable
                    key={scenario.id} style={styles.scenarioOption} scaleTo={0.98}
                    onPress={() => {
                      if (screen === "home") void startFlow(HINT_TO_CATEGORY[scenario.productHint], scenario.title);
                      else { setEditorPanel(null); setScenarioTitle(scenario.title); switchCategory(HINT_TO_CATEGORY[scenario.productHint]); }
                    }}
                  >
                    <Image source={{ uri: scenario.cover }} style={styles.scenarioThumb} />
                    <View style={styles.optionBody}>
                      <Text style={styles.settingsTitle}>{scenario.title}</Text>
                      <Text style={styles.settingsSummary}>{scenario.subtitle}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                  </ScalePressable>
                ))}
              </>
            )}
            {panelContent === "settings" && <SettingsPanel controller={controller} />}
            {panelContent === "ai" && <AIStudioPanel controller={controller} />}
            {panelContent === "photos" && (
              <>
                {cfg.category === 'photobook' && <Pressable style={styles.catalogProduct} accessibilityRole="button" onPress={controller.autoSmartArrange}>
                  <Ionicons name="sparkles-outline" size={22} color={colors.accent} />
                  <View style={styles.optionBody}><Text style={styles.settingsTitle}>Умный автомакет</Text><Text style={styles.settingsSummary}>Заменить раскладку с учётом пропорций и качества</Text></View>
                </Pressable>}
                <Pressable style={styles.catalogProduct} onPress={autoArrange}>
                  <Ionicons name="color-wand-outline" size={22} color={colors.accent} />
                  <View style={styles.optionBody}>
                    <Text style={styles.settingsTitle}>Разложить по времени</Text>
                    <Text style={styles.settingsSummary}>От старым к свежим</Text>
                  </View>
                </Pressable>
                <Pressable style={styles.catalogProduct} onPress={autoArrangeByLocation}>
                  <Ionicons name="location-outline" size={22} color={colors.accent} />
                  <View style={styles.optionBody}>
                    <Text style={styles.settingsTitle}>Разложить по местам</Text>
                    <Text style={styles.settingsSummary}>Снимки из одного места — рядом</Text>
                  </View>
                </Pressable>
                {cfg.category === "photobook" && unusedPhotos > 0 && cfg.spreads < MAX_SPREADS && (
                  <PrimaryButton label="Добавить развороты под неиспользованные фото" onPress={() => updateCfg({ spreads: Math.min(MAX_SPREADS, cfg.spreads + Math.ceil(unusedPhotos / 2)) })} />
                )}
                <Pressable style={[styles.catalogProduct, { marginTop: spacing.sm }]} onPress={pickMore}>
                  <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
                  <Text style={[styles.settingsTitle, { flex: 1 }]}>Добавить фото из галереи</Text>
                </Pressable>
                <Pressable style={styles.catalogProduct} onPress={() => { setEditorPanel(null); setScreen("photoPicker"); }}>
                  <Ionicons name="grid-outline" size={22} color={colors.accent} />
                  <Text style={[styles.settingsTitle, { flex: 1 }]}>Выбрать и удалить снимки</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </Pressable>
              </>
            )}
          </MotionView>
        </ScrollView>
        {panelContent !== "products" && (
          <View style={styles.sheetFooter}>
            <PrimaryButton label="Готово" onPress={() => setEditorPanel(null)} />
          </View>
        )}
      </Overlay>

      <PrintTextEditor visible={textEditing !== null} field={textField} value={textDraft} onChange={setTextDraft} onClose={() => setTextEditing(null)} onSave={() => { if (textEditing) updateCfg({ [textEditing]: textDraft }); setTextEditing(null); }} />

      <MotionView
        key={screen}
        kind="screen"
        dir={slideDir.current}
        style={styles.flex}
        staticContent={
          screen === "home"
          || screen === "orders"
          || screen === "profile"
          || (cfg.category === "postcard" && (screen === "builder" || screen === "checkout"))
        }
      >
        {children}
      </MotionView>
      {mainTab ? (
        <BottomNav
          active={mainTab}
          onHome={() => {
            if (mainTab !== "home") setScreen("home");
            setSelectedOrderId(null);
          }}
          onOrders={() => {
            setSelectedOrderId(null);
            if (mainTab !== "orders") setScreen("orders");
          }}
          onProfile={() => {
            if (mainTab !== "profile") setScreen("profile");
          }}
        />
      ) : null}
      <Toast toast={toast} top={insets.top + 8} />
      {dragPhoto ? (
        <Animated.View pointerEvents="none" style={[styles.dragGhost, { transform: [{ translateX: ghostPos.x }, { translateY: ghostPos.y }] }]}>
          <Image source={{ uri: photoById(photos, dragPhoto)?.uri }} style={styles.dragGhostImage} />
        </Animated.View>
      ) : null}
      {arCapabilities?.arSupported && ExpoAr ? (
        // Настоящий AR (ARKit/ARCore через expo-ar): камера и трекинг рендерятся
        // нативно, постер — 2D-оверлей, прибитый к проекции якоря на стене
        // (позиция и масштаб пересчитываются каждый кадр по проекциям якорей).
        <Modal visible={arOpen} animationType="slide" onRequestClose={() => setArOpen(false)} statusBarTranslucent>
          <View style={styles.arScreen}>
            <ExpoAr.ExpoArView
              ref={arRef}
              style={StyleSheet.absoluteFill}
              planeDetection="both"
              emitProjections
              onTap={(e) => { void handleArTap(e); }}
              onAnchorsChange={handleArAnchors}
              onProjection={handleArProjection}
              onTrackingStateChange={(e) => setArTracking(e.nativeEvent.state)}
              onError={(e) => setArNotice(`Ошибка AR: ${e.nativeEvent.message}`)}
            />
            {/* Постер «на стене» поверх нативного AR-рендера */}
            <Animated.View pointerEvents="none" style={[styles.arNativePoster, { width: arPosterSize.x, height: arPosterSize.y, transform: [{ translateX: arPosterPos.x }, { translateY: arPosterPos.y }] }]}>
              {photoById(photos, cfg.slots[0]?.photoId)?.uri ? (
                <Image source={{ uri: photoById(photos, cfg.slots[0]?.photoId)?.uri }} style={styles.arNativePosterImage} resizeMode="cover" />
              ) : (
                <View style={styles.arNativePosterPlaceholder}>
                  <Ionicons name="image-outline" size={36} color={colors.textSecondary} />
                  <Text style={styles.arPosterPlaceholderText}>Добавьте фото в постер</Text>
                </View>
              )}
            </Animated.View>
            {/* Слой щипка (только двумя пальцами) — не перекрывает тапы AR-виду */}
            <View style={StyleSheet.absoluteFill} {...arPinchResponder.panHandlers} pointerEvents="box-none" />
            <View style={[styles.arTopBar, { top: insets.top + 12 }]}>
              <Pressable style={styles.arCircleBtn} onPress={() => setArOpen(false)} accessibilityRole="button" accessibilityLabel="Закрыть AR-примерку" hitSlop={8}>
                <Ionicons name="close" size={22} color="#fff" />
              </Pressable>
            </View>
            <View style={[styles.arBottomBar, { bottom: insets.bottom + 16 }]} pointerEvents="box-none">
              <Text style={styles.arHint}>
                {arNotice
                  ?? (arPhase === "placed"
                    ? "Коснитесь нового места — переставить · щипок — размер"
                    : arTracking === "normal"
                      ? "Наведите камеру на стену и коснитесь экрана"
                      : arTracking === "unavailable"
                        ? "Трекинг недоступен — направьте камеру на освещённую поверхность"
                        : "Ведите камеру медленно по стене")}
              </Text>
              {arPhase === "placed" ? (
                <Pressable style={styles.arResetBtn} onPress={clearArAnchors} accessibilityRole="button" accessibilityLabel="Снять постер со стены" hitSlop={8}>
                  <Ionicons name="pin" size={16} color="#fff" />
                  <Text style={styles.arResetText}>Снять</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </Modal>
      ) : (
        // Expo Go / web: запасной псевдо-AR на датчиках движения + expo-camera.
        <PosterARView
          visible={arOpen} onClose={() => setArOpen(false)}
          photoUri={photoById(photos, cfg.slots[0]?.photoId)?.uri}
          aspect={posterAspect}
        />
      )}

      {/* Редактор фото: поворот, обрезка и локальные умные инструменты (фильтры, автоулучшение).
          Работает для любого фото: из лотка, печати, книги, открытки — правки видны везде. */}
      <PhotoEditorModal
        photo={editingPhoto}
        targetRatio={editorRatio}
        onClose={() => setEditingPhotoId(null)}
        onApply={applyPhotoEdit}
        toast={showToast}
      />
    </View>
  );
}
