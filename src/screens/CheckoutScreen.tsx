import { Ionicons } from "@expo/vector-icons";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { MotionView } from '../components/animation/MotionView';
import { ScreenHeader, StepBar } from '../components/navigation/index';
import { PrimaryButton, SectionTitle } from '../components/ui/index';
import { DELIVERY_OPTIONS, PAYMENT_OPTIONS } from '../config/catalog';
import { photoById } from '../domain/photos';
import { productDetails, productTitle } from '../domain/products';
import { SummaryRow } from '../features/checkout/SummaryRow';
import { FlatPreview } from '../features/editor/ProductPreview';
import type { PicPacController } from '../state/usePicPacController';
import { styles } from '../styles/app.styles';
import { colors, spacing } from '../styles/theme';
import { money } from '../utils/format';

export function CheckoutScreen({ controller }: { controller: PicPacController }) {
  const { aiCost, aiCount, base, bookPage, cfg, checkoutPreviewOpen, delivery, deliveryId, deliveryPrice, discount, filled, insets, paymentId, photos, placeOrder, postcardInteracting, promo, promoValid, recipient, setBookPage, setCheckoutPreviewOpen, setDeliveryId, setPaymentId, setPostcardInteracting, setPromo, setRecipient, setScreen, totalPrice } = controller;
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader title="Доставка и оплата" onBack={() => setScreen("builder")} />
      <StepBar step={3} />
      <ScrollView
        scrollEnabled={!postcardInteracting}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: spacing.xl }]}
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
      >
        <Pressable
          style={styles.orderReview} onPress={() => setCheckoutPreviewOpen(!checkoutPreviewOpen)} accessibilityRole="button"
          accessibilityState={{ expanded: checkoutPreviewOpen }}
        >
          <Image source={{ uri: photoById(photos, cfg.slots[0]?.photoId)?.uri ?? photos[0]?.uri }} style={styles.orderReviewImage} />
          <View style={styles.optionBody}>
            <Text style={styles.settingsTitle}>{productTitle(cfg)}</Text>
            <Text style={styles.settingsSummary}>{productDetails(cfg)} · проверить макет</Text>
          </View>
          <Ionicons name={checkoutPreviewOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.textSecondary} />
        </Pressable>
        {checkoutPreviewOpen && (
          <MotionView kind="section" staticContent={cfg.category === "postcard"}>
            <FlatPreview cfg={cfg} photos={photos} bookPage={bookPage} onBookPage={setBookPage} onInteractionChange={setPostcardInteracting} />
          </MotionView>
        )}

        <SectionTitle title="Получатель" />
        <TextInput
          style={styles.input} value={recipient.name} onChangeText={(t) => setRecipient((r) => ({ ...r, name: t }))}
          placeholder="Имя и фамилия" placeholderTextColor={colors.textSecondary} autoComplete="name"
        />
        <TextInput
          style={styles.input} value={recipient.phone} onChangeText={(t) => setRecipient((r) => ({ ...r, phone: t }))}
          placeholder="Телефон, например +375 29 000-00-00" placeholderTextColor={colors.textSecondary} keyboardType="phone-pad"
        />
        <TextInput
          style={styles.input} value={recipient.address} onChangeText={(t) => setRecipient((r) => ({ ...r, address: t }))}
          placeholder="Адрес доставки" placeholderTextColor={colors.textSecondary}
        />

        <SectionTitle title="Доставка" />
        {DELIVERY_OPTIONS.map((d) => {
          const on = deliveryId === d.id;
          return (
            <Pressable key={d.id} onPress={() => setDeliveryId(d.id)} style={[styles.optionRow, on && styles.optionRowActive]}>
              <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={20} color={on ? colors.accent : colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.optionLabel}>{d.label}</Text>
                <Text style={styles.optionSub}>{d.eta}</Text>
              </View>
              <Text style={styles.optionPrice}>{money(d.price)}</Text>
            </Pressable>
          );
        })}

        <SectionTitle title="Оплата" />
        {PAYMENT_OPTIONS.map((p) => {
          const on = paymentId === p.id;
          return (
            <Pressable key={p.id} onPress={() => setPaymentId(p.id)} style={[styles.optionRow, on && styles.optionRowActive]}>
              <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={20} color={on ? colors.accent : colors.textSecondary} />
              <Text style={[styles.optionLabel, { flex: 1 }]}>{p.label}</Text>
            </Pressable>
          );
        })}

        <SectionTitle title="Промокод" />
        <TextInput
          style={styles.input} value={promo} onChangeText={setPromo} placeholder="Введите промокод"
          placeholderTextColor={colors.textSecondary} autoCapitalize="characters"
        />

        <View style={styles.card}>
          <SummaryRow label="Товар" value={money(base)} />
          {aiCost > 0 ? <SummaryRow ai label={`AI-обработка · ${aiCount} ф. × ${filled} фото`} value={money(aiCost)} /> : null}
          <SummaryRow label={`Доставка · ${delivery?.label ?? ""}`} value={money(deliveryPrice)} />
          {promoValid ? <SummaryRow label="Промокод −10%" value={`−${money(discount)}`} accent /> : null}
          <View style={styles.summaryDivider} />
          <SummaryRow label="Итого" value={money(totalPrice)} strong />
        </View>
      </ScrollView>
      <View style={[styles.footerBar, styles.footerRow, { paddingBottom: insets.bottom + spacing.sm }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.footerPriceLabel}>К оплате</Text>
          <Text style={styles.footerPriceValue}>{money(totalPrice)}</Text>
        </View>
        <View style={{ flex: 1.2 }}>
          <PrimaryButton label="Оформить заказ" onPress={placeOrder} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
