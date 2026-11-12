import { Ionicons } from "@expo/vector-icons";
import { ScrollView, Text, View } from "react-native";
import { MotionView } from '../components/animation/MotionView';
import { ScreenHeader } from '../components/navigation/index';
import { SectionTitle } from '../components/ui/index';
import { ORDER_STATUSES } from '../config/catalog';
import { DraftCard } from '../features/drafts/DraftCard';
import { ActiveOrdersRow } from '../features/orders/ActiveOrdersRow';
import type { PicPacController } from '../state/usePicPacController';
import { styles } from '../styles/app.styles';
import { colors } from '../styles/theme';
import { IconName } from '../types/index';

export function ProfileScreen({ controller }: { controller: PicPacController }) {
  const { activeOrders, deleteDraft, insets, openDraft, orders, setScreen, setSelectedOrderId, visibleDrafts } = controller;

  const inProgress = orders.filter((o) => o.statusIndex < ORDER_STATUSES.length - 1).length;
  const stats: { label: string; value: number; icon: IconName }[] = [
    { label: "Заказов", value: orders.length, icon: "receipt-outline" },
    { label: "В работе", value: inProgress, icon: "time-outline" },
    { label: "Черновиков", value: visibleDrafts.length, icon: "bookmark-outline" },
  ];
  return (
    <View style={styles.flex}>
      <ScreenHeader title="Профиль" />
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        <MotionView kind="section">
          <View style={styles.profileCard}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>PP</Text>
            </View>
            <Text style={styles.profileName}>Мой профиль</Text>
            <View style={styles.statsRow}>
              {stats.map((s) => (
                <View key={s.label} style={styles.statTile}>
                  <Ionicons name={s.icon} size={18} color={colors.accent} />
                  <Text style={styles.statValue}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </MotionView>

        {activeOrders.length > 0 ? (
          <MotionView kind="section" delay={100}>
            <ActiveOrdersRow orders={activeOrders} onOpen={(id) => { setSelectedOrderId(id); setScreen("orders"); }} />
          </MotionView>
        ) : null}

        <MotionView kind="section" delay={200}>
          <SectionTitle title="Мои черновики" subtitle={visibleDrafts.length ? undefined : "Сохраняйте макеты кнопкой-закладкой в редакторе"} />
          {visibleDrafts.map((d) => (
            <DraftCard key={d.id} wide draft={d} onOpen={() => openDraft(d)} onDelete={() => deleteDraft(d)} />
          ))}
        </MotionView>

        <SectionTitle title="О приложении" />
        <Text style={styles.profileText}>PicPac — печать фото без лишних шагов: выберите снимки, посмотрите готовый макет и оформите заказ с доставкой.</Text>
      </ScrollView>
    </View>
  );

}
