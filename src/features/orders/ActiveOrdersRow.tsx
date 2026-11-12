import { ScrollView, useWindowDimensions, View } from "react-native";
import { SectionTitle } from '../../components/ui/index';
import { OrderTracker } from './OrderCards';
import type { MockOrder } from '../../types/index';
import { styles } from '../../styles/app.styles';
import { spacing } from '../../styles/theme';
import { plural } from '../../utils/format';

const CARD_GAP = 12;

// Горизонтальная лента активных заказов (главная, профиль): карточка почти на
// весь экран, краешек следующей подсказывает про скролл, привязка по одной.
// Пустой список — секция не рендерится вовсе.
export function ActiveOrdersRow({ orders, onOpen }: { orders: MockOrder[]; onOpen: (id: string) => void }) {
  const { width } = useWindowDimensions();
  if (orders.length === 0) return null;
  const cardW = Math.min(width * 0.86, 360);
  return (
    <>
      <SectionTitle
        title="Активные заказы"
        subtitle={orders.length > 1 ? `${orders.length} ${plural(orders.length, "заказ", "заказа", "заказов")} в работе — листайте` : undefined}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardW + CARD_GAP}
        decelerationRate="fast"
        style={{ marginHorizontal: -spacing.lg }}
        contentContainerStyle={styles.draftsRow}
      >
        {orders.map((order) => (
          <View key={order.id} style={{ width: cardW }}>
            <OrderTracker order={order} onPress={() => onOpen(order.id)} />
          </View>
        ))}
      </ScrollView>
    </>
  );
}
