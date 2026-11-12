import { Ionicons } from "@expo/vector-icons";
import { StyleProp, Text, View, ViewStyle } from "react-native";
import { ScalePressable } from '../../components/animation/ScalePressable';
import { PRODUCT_TABS } from '../../config/catalog';
import { styles } from '../../styles/app.styles';
import { PASTELS, PASTEL_INK } from '../../styles/theme';

export function ProductChoiceCard({ product, index, onPress, style, disabled }: {
  product: (typeof PRODUCT_TABS)[number]; index: number; onPress: () => void; style?: StyleProp<ViewStyle>; disabled?: boolean;
}) {
  return (
    <ScalePressable accessibilityRole="button" accessibilityLabel={product.label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.homeProduct, style, disabled && { opacity: 0.45 }]}>
      <View style={[styles.homeProductIcon, { backgroundColor: PASTELS[index % PASTELS.length] }]}>
        <Ionicons name={product.icon} size={22} color={PASTEL_INK[index % PASTEL_INK.length]} />
      </View>
      <Text style={styles.homeProductName}>{product.label}</Text>
      <Text style={styles.homeProductBlurb} numberOfLines={2}>{product.blurb}</Text>
      <Text style={styles.homeProductPrice}>{product.from}</Text>
    </ScalePressable>
  );
}
