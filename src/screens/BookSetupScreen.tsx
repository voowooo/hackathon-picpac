import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { ScreenHeader } from '../components/navigation/index';
import { PrimaryButton, Stepper } from '../components/ui/index';
import { BOOK_LINES, BOOK_LINE_IMAGES, MAX_SPREADS, MIN_SPREADS } from '../config/catalog';
import { baseEstimate, defaultSpreads } from '../domain/products';
import type { PicPacController } from '../state/usePicPacController';
import { FrostedSurface } from '../components/ui/FrostedSurface';
import { styles } from '../styles/app.styles';
import { PASTELS, colors, spacing } from '../styles/theme';
import { money } from '../utils/format';

export function BookSetupScreen({ controller }: { controller: PicPacController }) {
  const { cfg, chooseProductAfterUpload, insets, photos, scenarioTitle, setScreen, updateCfg, width } = controller;

  const line = BOOK_LINES.find((l) => l.id === cfg.bookLineId);
  const suggested = defaultSpreads(photos.length);
  // Половина ширины строки для сеток карточек (2 в ряд, зазор 10).
  const cardW = (width - spacing.lg * 2 - 10) / 2;
  return (
    <View style={styles.flex}>
      <ScreenHeader title="Оформление фотокниги" onBack={() => setScreen(chooseProductAfterUpload ? "productPicker" : "home")} />
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: 72, paddingBottom: insets.bottom + 120 }]} showsVerticalScrollIndicator={false}>
        {scenarioTitle ? (
          <View style={styles.setupScenario}>
            <Ionicons name="sparkles-outline" size={16} color={colors.accent} />
            <Text style={styles.setupScenarioText} numberOfLines={1}>{scenarioTitle} · {photos.length} фото</Text>
          </View>
        ) : (
          <View style={styles.setupScenario}>
            <Ionicons name="images-outline" size={16} color={colors.accent} />
            <Text style={styles.setupScenarioText} numberOfLines={1}>Выбрано фото: {photos.length}</Text>
          </View>
        )}

        <View style={styles.settingGroup}>
          <Text style={styles.settingGroupTitle}>Линейка</Text>
          <View style={styles.bookGrid}>
            {BOOK_LINES.map((l) => {
              const active = cfg.bookLineId === l.id;
              return (
                // Карточка целиком выбирает линейку (формат падает на первый допустимый).
                <Pressable
                  key={l.id}
                  onPress={() => updateCfg({ bookLineId: l.id, bookFormat: l.formats.includes(cfg.bookFormat) ? cfg.bookFormat : l.formats[0] })}
                  style={[styles.bookCard, { width: cardW }, active && styles.bookCardActive]}
                  accessibilityRole="button"
                  accessibilityLabel={`Выбрать линейку ${l.name}`}
                >
                  {/* Иконка: статический PNG из assets/books (заменяется файлом, не кодом) */}
                  <Image source={BOOK_LINE_IMAGES[l.id]} style={styles.bookCardPhoto} />
                  <View style={styles.bookCardHead}>
                    <Text style={[styles.bookCardName, active && { color: colors.accent }]}>{l.name}</Text>
                    <View style={[styles.bookCardCheck, active && styles.bookCardCheckOn]}>
                      {active ? <Ionicons name="checkmark" size={13} color="#fff" /> : null}
                    </View>
                  </View>
                  <Text style={styles.bookCardPrice}>от {money(l.basePrice)}</Text>
                  <Text style={styles.bookCardDesc} numberOfLines={3}>{l.desc}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={styles.settingGroup}>
          <Text style={styles.settingGroupTitle}>Формат</Text>
          <View style={styles.bookGrid}>
            {line?.formats.map((f, i) => {
              const active = cfg.bookFormat === f;
              const [fw, fh] = f.split("×").map(Number);
              return (
                // Карточка целиком выбирает формат.
                <Pressable
                  key={f}
                  onPress={() => updateCfg({ bookFormat: f })}
                  style={[styles.bookCard, { width: cardW }, active && styles.bookCardActive]}
                  accessibilityRole="button"
                  accessibilityLabel={`Выбрать формат ${f}`}
                >
                  {/* Схематичный прямоугольник страницы в пропорции формата, шапка — пастель по циклу */}
                  <View style={[styles.bookShapeBox, { backgroundColor: PASTELS[i % PASTELS.length] }]}>
                    <View style={[styles.bookShape, { aspectRatio: fw / fh }, active && styles.bookShapeActive]} />
                  </View>
                  <View style={styles.bookCardHead}>
                    <Text style={[styles.bookCardName, active && { color: colors.accent }]}>{f}</Text>
                    <View style={[styles.bookCardCheck, active && styles.bookCardCheckOn]}>
                      {active ? <Ionicons name="checkmark" size={13} color="#fff" /> : null}
                    </View>
                  </View>
                  <Text style={styles.bookCardDesc} numberOfLines={2}>Страница {fw} × {fh} см</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={styles.settingGroup}>
          <Text style={styles.settingGroupTitle}>Бумага</Text>
          <View style={styles.bookGrid}>
            {([
              ["matte", "Матовая", "Мягкая фактура без бликов — классика для альбомов"],
              ["glossy", "Глянцевая", "Яркие цвета и контраст, блеск на свету"],
            ] as const).map(([pid, name, desc]) => {
              const active = cfg.paper === pid;
              return (
                // Карточка целиком выбирает тип бумаги.
                <Pressable
                  key={pid}
                  onPress={() => updateCfg({ paper: pid })}
                  style={[styles.bookCard, { width: cardW }, active && styles.bookCardActive]}
                  accessibilityRole="button"
                  accessibilityLabel={`Выбрать бумагу: ${name}`}
                >
                  {/* Свотч: матовая — ровный тон, глянцевая — с бликом */}
                  {/* <View style={[styles.bookSwatch, active && styles.bookShapeActive, pid === "matte" ? styles.bookSwatchMatte : styles.bookSwatchGlossy]}>
                      {pid === "glossy" ? <View style={styles.bookSwatchShine} /> : null}
                    </View> */}
                  <View style={styles.bookCardHead}>
                    <Text style={[styles.bookCardName, active && { color: colors.accent }]}>{name}</Text>
                    <View style={[styles.bookCardCheck, active && styles.bookCardCheckOn]}>
                      {active ? <Ionicons name="checkmark" size={13} color="#fff" /> : null}
                    </View>
                  </View>
                  <Text style={styles.bookCardDesc} numberOfLines={5}>{desc}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={styles.settingGroup}>
          <Text style={styles.settingGroupTitle}>Объём</Text>
          <Text style={styles.settingGroupHint}>Больше разворотов — больше фото в книге</Text>
          <Stepper
            label={`${cfg.spreads} разворотов · ${cfg.spreads * 2 + 2} стр.`}
            onMinus={() => updateCfg({ spreads: cfg.spreads - 1 })} onPlus={() => updateCfg({ spreads: cfg.spreads + 1 })}
            minusDisabled={cfg.spreads <= MIN_SPREADS} plusDisabled={cfg.spreads >= MAX_SPREADS}
          />
          {suggested !== cfg.spreads ? (
            <Pressable onPress={() => updateCfg({ spreads: suggested })} hitSlop={8} style={styles.setupSuggest}>
              <Text style={styles.linkText}>Подобрать под {photos.length} фото: {suggested} разворотов</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.setupSummary}>
          <View style={styles.optionBody}>
            <Text style={styles.settingsTitle}>Итого за книгу</Text>
            <Text style={styles.settingsSummary}>{cfg.spreads * 2 + 2} страниц · бумага: {cfg.paper === "matte" ? "матовая" : "глянцевая"}</Text>
          </View>
          <Text style={styles.setupSummaryPrice}>{money(baseEstimate(cfg))}</Text>
        </View>
      </ScrollView>
      <FrostedSurface style={[{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20 }, styles.footerBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <PrimaryButton label="Перейти в редактор" icon="arrow-forward" onPress={() => setScreen("builder")} />
      </FrostedSurface>
    </View>
  );

}
