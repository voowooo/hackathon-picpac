import { Ionicons } from "@expo/vector-icons";
import { Text } from "react-native";
import { ScalePressable } from '../../components/animation/ScalePressable';
import { styles } from '../../styles/app.styles';
import { colors } from '../../styles/theme';
import { IconName } from '../../types/index';

export function ActionTile({
  icon, label, onPress, disabled, active,
}: { icon: IconName; label: string; onPress: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <ScalePressable onPress={onPress} disabled={disabled} wrapStyle={{ flex: 1 }} style={[styles.actionTile, active && styles.actionTileActive, disabled && { opacity: 0.4 }]}>
      <Ionicons name={icon} size={20} color={active ? colors.accent : colors.text} />
      <Text style={[styles.actionTileLabel, active && { color: colors.accent }]} numberOfLines={1}>{label}</Text>
    </ScalePressable>
  );
}
