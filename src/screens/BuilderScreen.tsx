import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { MotionView } from '../components/animation/MotionView';
import { PhotoMenuTransition } from '../components/animation/PhotoMenuTransition';
import { ScalePressable } from '../components/animation/ScalePressable';
import { Notice } from '../components/feedback/index';
import { ScreenHeader, StepBar } from '../components/navigation/index';
import { Chip, PrimaryButton, SettingGroup } from '../components/ui/index';
import { PRINT_FORMATS, SPREAD_LAYOUTS } from '../config/catalog';
import { getPrintFinish, productDetails, productTitle, slotPrintFinish, spreadLayoutOf } from '../domain/products';
import { ActionTile } from '../features/editor/ActionTile';
import { renderFinishEditor } from '../features/editor/panels/renderFinishEditor';
import { FlatPreview } from '../features/editor/ProductPreview';
import { BookSettingsSection } from '../features/photobook/components/BookSettingsSection';
import { LayoutThumb } from '../features/photobook/components/LayoutThumb';
import { CollapsibleBottomDock } from '../features/photos/components/CollapsibleBottomDock';
import { PhotoTray } from '../features/photos/components/PhotoTray';
import type { PicPacController } from '../state/usePicPacController';
import { styles } from '../styles/app.styles';
import { COVER_FRAME_COLORS, COVER_FRAME_WIDTHS, COVER_TITLE_COLORS, colors, spacing } from '../styles/theme';
import { PrintFinish } from '../types/index';
import { colorName, hexColorsEqual, isDark, money, normalizeHexColor, parseHexColor } from '../utils/format';
import { QualityNotice } from '../features/smart-tools/QualityNotice';

export function BuilderScreen({ controller }: { controller: PicPacController }) {
  const { checkoutWarning, qualityChecking, reviewCheckout } = controller;
  const { aiCost, applyPrintToAll, beginDrag, bookPage, cfg, clearSelectedSlot, dragPhoto, dropTargetId, emptySlots, endDrag, filled, handleSlotPress, hexTarget, hexValid, hexValue, insets, isSaved, leaveBuilder, lockTrayScroll, lowRes, moveDrag, onTrayPick, openPhotoEditor, openTextEditor, photos, pickMore, postcardInteracting, price, registerSlot, removeSpread, replaceSlotFromGallery, saveDraft, selectedSlot, selectedSlotId, setArOpen, setBookPage, setEditorPanel, setHexTarget, setHexValue, setPostcardInteracting, setScreen, setSpreadLayout, setSwapSlotId, spreadIsEmpty, swapSlotId, trayScrollLocked, unusedPhotos, updateCfg, updatePrintSlot } = controller;

  const fixedCapacity = cfg.category === "photobook" || cfg.category === "poster" || cfg.category === "postcard";
  const settingsSummary =
    cfg.category === "print"
      ? `${PRINT_FORMATS.find((f) => f.id === cfg.printFormatId)?.label} · ${cfg.paper === "matte" ? "Матовая" : "Глянцевая"} · ${cfg.copies} коп.`
      : productDetails(cfg);
  const progressText = emptySlots > 0 ? `Осталось добавить фото: ${emptySlots}` : unusedPhotos > 0 ? `Не использовано фото: ${unusedPhotos}` : "Макет заполнен";
  const activeLayoutId = spreadLayoutOf(cfg, bookPage).id;
  const coverShowTitle = cfg.coverShowTitle ?? true;
  const frameWidthLabel = COVER_FRAME_WIDTHS.find((f) => f.width === (cfg.coverFrameWidth ?? 14))?.label ?? "Своя";
  return (
    <View style={styles.flex}>
      <ScreenHeader
        title="Макет" onBack={leaveBuilder}
        right={
          <ScalePressable
            accessibilityRole="button" accessibilityLabel="Сохранить черновик" onPress={saveDraft} hitSlop={8} scaleTo={0.88}
            style={[styles.backBtn, isSaved && styles.draftBtnSaved]}
          >
            <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={20} color={isSaved ? "#fff" : colors.text} />
          </ScalePressable>
        }
      />
      {/* <StepBar step={2} /> */}
      <ScrollView style={styles.flex} scrollEnabled={!postcardInteracting} showsVerticalScrollIndicator={false} contentContainerStyle={styles.editorContent}>
        <StepBar step={2} />
        <View style={styles.builderTitle}>
          <Text style={styles.productSelectorName}>{productTitle(cfg)}</Text>
          <Text style={styles.productSelectorHint}>{isSaved ? "Сохранено в черновиках" : "Не сохранено в черновиках"}</Text>
        </View>
        <QualityNotice
          photos={photos.filter((p) => cfg.slots.some((s) => s.photoId === p.id))}
          indexFrom={photos}
          checking={qualityChecking}
        />
        {/* <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.switcher} contentContainerStyle={styles.switcherRow}>
            {PRODUCT_TABS.map((p) => {
              const on = cfg.category === p.id;
              return (
                <ScalePressable
                  key={p.id} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={p.label}
                  onPress={() => switchCategory(p.id)} scaleTo={0.94} style={[styles.switchPill, on && styles.switchPillOn]}
                >
                  <Ionicons name={p.icon} size={16} color={on ? "#fff" : colors.text} />
                  <Text style={[styles.switchPillText, on && { color: "#fff" }]}>{p.short}</Text>
                </ScalePressable>
              );
            })}
            <ScalePressable accessibilityRole="button" accessibilityLabel="Идеи" onPress={() => setEditorPanel("products")} scaleTo={0.94} style={styles.switchPill}>
              <Ionicons name="gift-outline" size={16} color={colors.text} />
              <Text style={styles.switchPillText}>Идеи</Text>
            </ScalePressable>
          </ScrollView> */}
        <MotionView key={cfg.category} kind="product" staticContent={cfg.category === "postcard"}>
          <FlatPreview
            key={cfg.category} cfg={cfg} photos={photos} selectedSlotId={selectedSlotId} swapSlotId={swapSlotId}
            onSlotPress={handleSlotPress} bookPage={bookPage} onBookPage={setBookPage}
            registerSlot={registerSlot} dropTargetId={dropTargetId} onTextPress={openTextEditor}
            onInteractionChange={setPostcardInteracting}
          />
        </MotionView>

        {/* Фотопечать: размер и рамки/поля прямо под превью. С выбранным
              отпечатком — правки только для него, без выбора — общие настройки. */}
        {cfg.category === "print" ? (
          <View style={styles.layoutPicker}>
            <View style={styles.layoutPickerHead}>
              <Text style={styles.layoutPickerTitle}>Размер и оформление</Text>
              {selectedSlot ? (
                <Chip label="Применить ко всем" onPress={() => applyPrintToAll(selectedSlot.id)} />
              ) : null}
            </View>
            <Text style={styles.layoutPickerHint}>
              {selectedSlot
                ? `Отпечаток ${cfg.slots.indexOf(selectedSlot) + 1} из ${cfg.slots.length} — настройки только для него`
                : "Общие настройки. Нажмите на отпечаток в превью, чтобы настроить его отдельно"}
            </Text>
            <SettingGroup title="Размер">
              {PRINT_FORMATS.map((f) => (
                <Chip
                  key={f.id} label={`${f.label} · ${money(f.pricePer)}`}
                  active={(selectedSlot?.printFormatId ?? cfg.printFormatId) === f.id}
                  onPress={() => (selectedSlot ? updatePrintSlot(selectedSlot.id, { printFormatId: f.id }) : updateCfg({ printFormatId: f.id }))}
                />
              ))}
            </SettingGroup>
            {(() => {
              const finish = selectedSlot ? slotPrintFinish(cfg, selectedSlot) : getPrintFinish(cfg, "print");
              const update = (patch: Partial<PrintFinish>) =>
                selectedSlot
                  ? updatePrintSlot(selectedSlot.id, { printFinish: { ...finish, ...patch } })
                  : updateCfg({ printFinish: { ...finish, ...patch } });
              return renderFinishEditor(finish, update, "print");
            })()}
          </View>
        ) : null}

        {cfg.category === "photobook" ? (
          <>
            <BookSettingsSection active={bookPage > 0}>
              <View style={styles.layoutPicker}>
                <View style={styles.layoutPickerHead}>
                  <Text style={styles.layoutPickerTitle}>Макет разворота {Math.max(1, bookPage)}</Text>
                  <View style={styles.layoutPickerActions}>
                    {/* <Pressable onPress={() => applyLayoutToAll(activeLayoutId)} hitSlop={6} accessibilityRole="button" accessibilityLabel="Применить макет ко всем разворотам">
                    <Text style={styles.linkText}>Ко всем</Text>
                  </Pressable> */}
                    {spreadIsEmpty(bookPage) ? (
                      <Pressable onPress={() => removeSpread(bookPage)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Удалить пустой разворот ${bookPage}`}>
                        <View style={styles.removeSpreadBtn}>
                          <Ionicons name="trash-outline" size={12} color={colors.danger} />
                          <Text style={styles.removeSpreadText}>Удалить</Text>
                        </View>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.layoutRow}>
                  {SPREAD_LAYOUTS.map((l) => {
                    const on = l.id === activeLayoutId;
                    return (
                      <ScalePressable
                        key={l.id} onPress={() => setSpreadLayout(bookPage, l.id)} scaleTo={0.94}
                        accessibilityRole="button" accessibilityLabel={`Макет: ${l.name}`}
                        accessibilityState={{ selected: on }}
                        style={[styles.layoutCard, on && styles.layoutCardOn]}
                      >
                        <LayoutThumb layout={l} />
                        <Text style={[styles.layoutName, on && styles.layoutNameOn]}>{l.name}</Text>
                      </ScalePressable>
                    );
                  })}
                </ScrollView>
              </View>
            </BookSettingsSection>
            <BookSettingsSection active={bookPage === 0}>
              <View style={styles.layoutPicker}>
                <View style={styles.layoutPickerHead}>
                  <Text style={styles.layoutPickerTitle}>Оформление обложки</Text>
                </View>

                {/* Чекбокс: показывать название на обложке */}
                <Pressable
                  accessibilityRole="checkbox" accessibilityState={{ checked: coverShowTitle }}
                  onPress={() => updateCfg({ coverShowTitle: !coverShowTitle })}
                  style={styles.coverCheckRow}
                >
                  <View style={[styles.coverCheck, coverShowTitle && styles.coverCheckOn]}>
                    {coverShowTitle ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
                  </View>
                  <Text style={styles.coverCheckLabel}>Отображать название</Text>
                </Pressable>
                {coverShowTitle ? (
                  <>
                    <TextInput
                      style={styles.input} value={cfg.bookTitle} onChangeText={(t) => updateCfg({ bookTitle: t })}
                      placeholder="Заголовок на обложке" placeholderTextColor={colors.textSecondary} maxLength={40}
                    />
                    <SettingGroup title="Цвет названия" hint={colorName(cfg.coverTitleColor)}>
                      {COVER_TITLE_COLORS.map((c) => (
                        <Pressable
                          key={c} accessibilityRole="button" accessibilityLabel={`Цвет названия: ${colorName(c)}`}
                          onPress={() => updateCfg({ coverTitleColor: c })}
                          style={[styles.swatch, { backgroundColor: c }, hexColorsEqual(cfg.coverTitleColor, c) && styles.swatchActive]}
                        >
                          {hexColorsEqual(cfg.coverTitleColor, c) ? <Ionicons name="checkmark" size={18} color={isDark(c) ? "#fff" : colors.text} /> : null}
                        </Pressable>
                      ))}
                      {/* Свой цвет: ввод HEX */}
                      <Pressable
                        accessibilityRole="button" accessibilityLabel="Свой цвет названия"
                        onPress={() => { setHexTarget(hexTarget === "title" ? null : "title"); setHexValue(normalizeHexColor(cfg.coverTitleColor, "#FFFFFF")); }}
                        style={[styles.swatch, styles.swatchCustom, !COVER_TITLE_COLORS.some(c => hexColorsEqual(cfg.coverTitleColor, c)) && styles.swatchActive, { backgroundColor: parseHexColor(cfg.coverTitleColor) ?? colors.card }]}
                      >
                        {COVER_TITLE_COLORS.some(c => hexColorsEqual(cfg.coverTitleColor, c))
                          ? <Ionicons name="color-palette-outline" size={16} color={colors.textSecondary} />
                          : <Ionicons name="checkmark" size={18} color={isDark(cfg.coverTitleColor ?? "#FFFFFF") ? "#fff" : colors.text} />}
                      </Pressable>
                    </SettingGroup>
                    {hexTarget === "title" ? (
                      <View style={styles.hexRow}>
                        <TextInput
                          style={styles.hexInput} value={hexValue} maxLength={7} autoCapitalize="none" autoCorrect={false}
                          placeholder="#RRGGBB" placeholderTextColor={colors.textSecondary}
                          onChangeText={(t) => { setHexValue(t); const parsed = parseHexColor(t); if (parsed) updateCfg({ coverTitleColor: parsed }); }}
                        />
                        <View style={[styles.swatch, styles.hexPreview, { backgroundColor: parseHexColor(hexValue) ?? parseHexColor(cfg.coverTitleColor) ?? "#E5E0DA" }]} />
                      </View>
                    ) : null}
                  </>
                ) : null}

                <SettingGroup title="Стиль фото" hint={cfg.coverStyle === "framed" ? "Фото в рамке" : "Фото на всю обложку"}>
                  <Chip label="Фото" active={cfg.coverStyle !== "framed"} onPress={() => updateCfg({ coverStyle: "full" })} />
                  <Chip label="Фото в рамке" active={cfg.coverStyle === "framed"} onPress={() => updateCfg({ coverStyle: "framed" })} />
                </SettingGroup>

                {cfg.coverStyle === "framed" ? (
                  <>
                    <SettingGroup title="Ширина рамки" hint={frameWidthLabel}>
                      {COVER_FRAME_WIDTHS.map((f) => (
                        <Chip
                          key={f.width} label={f.label} active={(cfg.coverFrameWidth ?? 14) === f.width}
                          onPress={() => updateCfg({ coverFrameWidth: f.width })}
                        />
                      ))}
                    </SettingGroup>
                    <SettingGroup title="Цвет рамки" hint={colorName(cfg.coverFrameColor)}>
                      {COVER_FRAME_COLORS.map((c) => (
                        <Pressable
                          key={c} accessibilityRole="button" accessibilityLabel={`Цвет рамки: ${colorName(c)}`}
                          onPress={() => updateCfg({ coverFrameColor: c })}
                          style={[styles.swatch, { backgroundColor: c }, hexColorsEqual(cfg.coverFrameColor, c) && styles.swatchActive]}
                        >
                          {hexColorsEqual(cfg.coverFrameColor, c) ? <Ionicons name="checkmark" size={18} color={isDark(c) ? "#fff" : colors.text} /> : null}
                        </Pressable>
                      ))}
                      {/* Свой цвет: ввод HEX */}
                      <Pressable
                        accessibilityRole="button" accessibilityLabel="Свой цвет рамки"
                        onPress={() => { setHexTarget(hexTarget === "frame" ? null : "frame"); setHexValue(normalizeHexColor(cfg.coverFrameColor, "#F5E6D3")); }}
                        style={[styles.swatch, styles.swatchCustom, !COVER_FRAME_COLORS.some(c => hexColorsEqual(cfg.coverFrameColor, c)) && styles.swatchActive, { backgroundColor: parseHexColor(cfg.coverFrameColor) ?? colors.card }]}
                      >
                        {COVER_FRAME_COLORS.some(c => hexColorsEqual(cfg.coverFrameColor, c))
                          ? <Ionicons name="color-palette-outline" size={16} color={colors.textSecondary} />
                          : <Ionicons name="checkmark" size={18} color={isDark(cfg.coverFrameColor ?? "#F5E6D3") ? "#fff" : colors.text} />}
                      </Pressable>
                    </SettingGroup>
                    {hexTarget === "frame" ? (
                      <View style={styles.hexRow}>
                        <TextInput
                          style={styles.hexInput} value={hexValue} maxLength={7} autoCapitalize="none" autoCorrect={false}
                          placeholder="#RRGGBB" placeholderTextColor={colors.textSecondary}
                          onChangeText={(t) => { setHexValue(t); const parsed = parseHexColor(t); if (parsed) updateCfg({ coverFrameColor: parsed }); }}
                        />
                        <View style={[styles.swatch, styles.hexPreview, { backgroundColor: parseHexColor(hexValue) ?? parseHexColor(cfg.coverFrameColor) ?? "#E5E0DA" }]} />
                      </View>
                    ) : null}
                  </>
                ) : null}
              </View>
            </BookSettingsSection>
          </>
        ) : null}

        {/* AR: примерить постер на стену — только для постера */}
        {cfg.category === "poster" ? (
          <Pressable
            accessibilityRole="button" accessibilityLabel="AR: примерить постер на стену"
            style={styles.arEntry} onPress={() => setArOpen(true)}
          >
            <Ionicons name="scan-outline" size={20} color={colors.accent} />
            <View style={styles.optionBody}>
              <Text style={styles.settingsTitle}>AR · Примерить на стену</Text>
              <Text style={styles.settingsSummary}>Камера + ваш постер: двигайте и масштабируйте</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </Pressable>
        ) : null}

        {/* {fixedCapacity && (
            <Pressable onPress={() => setEditorPanel("photos")} style={styles.progressCard} accessibilityRole="button">
              <View style={styles.progressTop}>
                <Ionicons name={emptySlots === 0 && unusedPhotos === 0 ? "checkmark-circle" : "information-circle-outline"} size={18} color={colors.accent} />
                <Text style={styles.attentionText}>{progressText}</Text>
                <Text style={styles.progressCount}>{filled}/{cfg.slots.length}</Text>
              </View>
              <ProgressBar value={cfg.slots.length ? filled / cfg.slots.length : 0} />
            </Pressable>
          )} */}

        {lowRes > 0 && (
          <Notice tone="warn" icon="warning-outline" text={`Низкое разрешение: ${lowRes} фото могут напечататься нечётко`} actionLabel="Проверить" onAction={() => setEditorPanel("ai")} />
        )}



        <View style={styles.editorOptions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Настроить печать" style={styles.editorOption} onPress={() => setEditorPanel("settings")}>
            <Ionicons name="options-outline" size={20} color={colors.accent} />
            <View style={styles.optionBody}>
              <Text style={styles.settingsTitle}>Формат и оформление</Text>
              <Text style={styles.settingsSummary}>{settingsSummary}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </Pressable>
          <View style={styles.optionDivider} />
          <Pressable accessibilityRole="button" accessibilityLabel="Управлять фото" style={styles.editorOption} onPress={() => setEditorPanel("photos")}>
            <Ionicons name="images-outline" size={20} color={colors.accent} />
            <View style={styles.optionBody}>
              <Text style={styles.settingsTitle}>Фотографии и автомакет</Text>
              <Text style={styles.settingsSummary}>{`${photos.length} фото`}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </Pressable>
        </View>
      </ScrollView>
      {/* Лоток не нужен в режиме фотопечати: фото распределяются автоматически,
            замена — тапом по отпечатку (панель действий над футером). */}
      {cfg.category !== "print" && (
        <PhotoTray
          photos={photos} slots={cfg.slots} selectedPhotoId={selectedSlot?.photoId} draggingId={dragPhoto}
          scrollLocked={trayScrollLocked}
          note={unusedPhotos > 0 ? `Не использовано ${unusedPhotos} фото` : emptySlots > unusedPhotos ? `Добавьте еще ${emptySlots} фото` : ""}
          top={
            swapSlotId ? (
              <Notice tone="info" icon="swap-horizontal-outline" text="Выберите второе фото в превью" actionLabel="Отмена" onAction={() => setSwapSlotId(null)} />
            ) : selectedSlot ? (
              <View style={styles.selBar}>
                <View style={styles.actionRow}>
                  <ActionTile icon="images-outline" label="Из галереи" onPress={() => void replaceSlotFromGallery(selectedSlot.id)} />
                  {/* <ActionTile icon="swap-horizontal-outline" label="Поменять" onPress={() => setSwapSlotId(selectedSlot.id)} /> */}
                  <ActionTile icon="file-tray-full-outline" label="В лоток" disabled={!selectedSlot.photoId} onPress={clearSelectedSlot} />
                  <ActionTile icon="create-outline" label="Редактировать" disabled={!selectedSlot.photoId} onPress={() => openPhotoEditor(selectedSlot)} />
                </View>
              </View>
            ) : null
          }
          onPick={onTrayPick} onAdd={pickMore}
          onDragStart={beginDrag} onDragMove={moveDrag} onDragDrop={endDrag} onDragIntent={lockTrayScroll}
        />
      )}
      {cfg.category === "print" && selectedSlot ? (
        <CollapsibleBottomDock
          title={`Отпечаток ${cfg.slots.indexOf(selectedSlot) + 1} из ${cfg.slots.length}`}
          icon="images-outline"
          dockStyle={{ paddingHorizontal: spacing.lg }}
        >
          <PhotoMenuTransition key={selectedSlot.id} style={styles.selBar}>
            <View style={styles.actionRow}>
              <ActionTile icon="images-outline" label="Из галереи" onPress={() => void replaceSlotFromGallery(selectedSlot.id)} />
              <ActionTile icon="create-outline" label="Редактировать" disabled={!selectedSlot.photoId} onPress={() => openPhotoEditor(selectedSlot)} />
            </View>
          </PhotoMenuTransition>
        </CollapsibleBottomDock>
      ) : null}
      {checkoutWarning && <Notice tone="warn" icon="warning-outline" text={checkoutWarning} />}
      <View style={[styles.footerBar, styles.footerRow, { paddingBottom: insets.bottom + spacing.sm }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.footerPriceLabel}>{aiCost > 0 ? `В т.ч. AI +${money(aiCost)}` : "К оплате"}</Text>
          <Text style={styles.footerPriceValue}>{money(price)}</Text>
        </View>
        <View style={{ flex: 1.2 }}>
          <PrimaryButton label={qualityChecking ? 'Проверка фото…' : checkoutWarning ? 'Всё равно печатать' : 'Оформить'} icon="arrow-forward" disabled={filled === 0 || qualityChecking > 0} onPress={reviewCheckout} />
        </View>
      </View>
    </View>
  );

}
