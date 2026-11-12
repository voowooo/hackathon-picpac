import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { HOME_HERO_IMAGES } from "../assets/homeHero";
import { MotionView } from '../components/animation/MotionView';
import { PrimaryButton, SectionTitle } from '../components/ui/index';
import { PRODUCT_TABS } from '../config/catalog';
import { ProductChoiceCard } from '../features/catalog/ProductChoiceCard';
import { DraftCard } from '../features/drafts/DraftCard';
import { ActiveOrdersRow } from '../features/orders/ActiveOrdersRow';
import type { PicPacController } from '../state/usePicPacController';
import { styles } from '../styles/app.styles';
import { colors, spacing } from '../styles/theme';

export function HomeScreen({ controller }: { controller: PicPacController }) {
  const { activeOrders, deleteDraft, insets, openDraft, photos, setEditorPanel, setScreen, setSelectedOrderId, startFlow, visibleDrafts } = controller;
  return (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
      <View style={styles.homeBrand}>
        {/* <Text style={styles.brandName}>PicPac</Text> */}
        <Image source={require("../../assets/logo.png")} style={styles.brandLogo} resizeMode="contain" />
      </View>
      <View style={styles.homePrints} pointerEvents="none">
        {HOME_HERO_IMAGES.map((source, i) => (
          <View key={i} style={[styles.homePrint, { transform: [{ rotate: `${(i - 1) * 12}deg` }], left: `${8 + i * 20}%`, top: i === 1 ? 0 : 18, zIndex: i === 1 ? 3 : i }]}>
            <View style={styles.homePrintImage}>
              <Image source={source} style={[StyleSheet.absoluteFill, styles.fill]} resizeMode="cover" fadeDuration={0} />
            </View>
          </View>
        ))}
      </View>
      <Text style={styles.homeHeading}>Ваши фото на бумаге</Text>
      <Text style={styles.homeDescription}>Выберите снимки, настройте макет и оформите заказ за три шага.</Text>
      <PrimaryButton label="Загрузить фото" icon="images-outline" onPress={() => startFlow(null)} />
      {photos.length > 0 && (
        <Pressable style={styles.homeContinue} onPress={() => setScreen("builder")}>
          <Text style={styles.linkText}>Продолжить мой заказ</Text>
        </Pressable>
      )}

      {activeOrders.length > 0 ? (
        <MotionView kind="section" delay={120}>
          <ActiveOrdersRow orders={activeOrders} onOpen={(id) => { setSelectedOrderId(id); setScreen("orders"); }} />
        </MotionView>
      ) : null}

      {visibleDrafts.length > 0 ? (
        <MotionView kind="section" delay={200}>
          <SectionTitle title="Черновики" subtitle="Продолжите с того места, где остановились" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.lg }} contentContainerStyle={styles.draftsRow}>
            {visibleDrafts.map((d) => (
              <DraftCard key={d.id} draft={d} onOpen={() => openDraft(d)} onDelete={() => deleteDraft(d)} />
            ))}
          </ScrollView>
        </MotionView>
      ) : null}

      <MotionView kind="section" delay={280}>
        <SectionTitle title="Что напечатать" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.lg }} contentContainerStyle={styles.draftsRow}>
          {PRODUCT_TABS.map((p, i) => (
            <ProductChoiceCard key={p.id} product={p} index={i} onPress={() => void startFlow(p.id)} />
          ))}
        </ScrollView>
      </MotionView>

      <Pressable accessibilityRole="button" style={styles.catalogLink} onPress={() => setEditorPanel("products")}>
        <View>
          <Text style={styles.settingsTitle}>Идеи для подарка</Text>
          <Text style={styles.settingsSummary}>Готовые сценарии: путешествие, малыш, семейный архив</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </Pressable>
    </ScrollView>
  );
}
