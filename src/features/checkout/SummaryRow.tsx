import { Text, View } from "react-native";
import { styles } from '../../styles/app.styles';
import { colors } from '../../styles/theme';

export function SummaryRow({ label, value, strong, accent, ai }: { label: string; value: string; strong?: boolean; accent?: boolean; ai?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, strong && styles.summaryStrong, ai && { color: colors.ai }]}>{label}</Text>
      <Text style={[styles.summaryValue, strong && styles.summaryStrong, accent && { color: colors.safe }, ai && { color: colors.ai }]}>{value}</Text>
    </View>
  );
}
