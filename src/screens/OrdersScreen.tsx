import { ScrollView, Text, View } from "react-native";
import { MotionView } from '../components/animation/MotionView';
import { ScreenHeader } from '../components/navigation/index';
import { PrimaryButton, SectionTitle } from '../components/ui/index';
import { ORDER_STATUSES } from '../config/catalog';
import { OrderCard, OrderTracker } from '../features/orders/OrderCards';
import type { PicPacController } from '../state/usePicPacController';
import { styles } from '../styles/app.styles';

export function OrdersScreen({ controller }: { controller: PicPacController }) {
  const { insets, orders, selectedOrder, setSelectedOrderId, startFlow } = controller;
  return (
    <View style={styles.flex}>
      <ScreenHeader title={selectedOrder ? "Заказ" : "Заказы"} onBack={selectedOrder ? () => setSelectedOrderId(null) : undefined} />
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        {selectedOrder ? (
          <>
            <MotionView kind="section">
              <OrderTracker order={selectedOrder} />
            </MotionView>
            <MotionView kind="section" delay={100}>
              <OrderCard order={selectedOrder} />
            </MotionView>
            <MotionView kind="section" delay={180}>
              <View style={styles.card}>
                <Text style={styles.checkoutLine}>Детали</Text>
                <Text style={styles.checkoutMeta}>{selectedOrder.items}</Text>
                <Text style={styles.checkoutMeta}>№ {selectedOrder.id}</Text>
              </View>
              <PrimaryButton label="Повторить заказ" icon="refresh-outline" variant="secondary" onPress={() => startFlow(undefined, selectedOrder.scenario)} />
            </MotionView>
          </>
        ) : (
          <>
            {(() => {
              // Активные: заказ ещё в пути (не достиг «Доставлен»).
              const active = orders.filter((o) => !o.cancelled && o.statusIndex < ORDER_STATUSES.length - 1);
              // История: завершённые (дошли до «Доставлен») и отменённые заказы.
              const done = orders.filter((o) => o.cancelled || o.statusIndex >= ORDER_STATUSES.length - 1);
              return (
                <>
                  {active[0] ? (
                    <MotionView kind="section">
                      <SectionTitle title="Активный заказ" />
                      <OrderTracker order={active[0]} onPress={() => setSelectedOrderId(active[0].id)} />
                    </MotionView>
                  ) : null}
                  {active.length > 1 ? (
                    <>
                      <SectionTitle title="Ещё в работе" />
                      {active.slice(1).map((o, i) => (
                        <MotionView key={o.id} kind="section" delay={80 + i * 80}>
                          <OrderCard order={o} onPress={() => setSelectedOrderId(o.id)} onRepeat={() => startFlow(undefined, o.scenario)} />
                        </MotionView>
                      ))}
                    </>
                  ) : null}
                  <SectionTitle title="История" />
                  {done.length ? (
                    done.map((o, i) => (
                      <MotionView key={o.id} kind="section" delay={120 + i * 80}>
                        <OrderCard order={o} onPress={() => setSelectedOrderId(o.id)} onRepeat={() => startFlow(undefined, o.scenario)} />
                      </MotionView>
                    ))
                  ) : (
                    <Text style={styles.checkoutMeta}>Здесь появятся заказы после доставки</Text>
                  )}
                </>
              );
            })()}
          </>
        )}
      </ScrollView>
    </View>
  );
}
