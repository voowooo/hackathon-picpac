import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, Text, View } from "react-native";
import { ScalePressable } from '../../components/animation/ScalePressable';
import { PRODUCT_TABS } from '../../config/catalog';
import { filledCount } from '../../domain/products';
import { styles } from '../../styles/app.styles';
import { colors } from '../../styles/theme';
import { Draft } from '../../types/index';
import { formatDraftDate } from '../../utils/format';

export function DraftCard({ draft, onOpen, onDelete, wide }: { draft: Draft; onOpen: () => void; onDelete: () => void; wide?: boolean }) {
  const thumb = draft.photos[0]?.uri;
  const icon = PRODUCT_TABS.find((t) => t.id === draft.cfg.category)?.icon ?? "document-outline";
  return (
    <ScalePressable
      onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Открыть черновик ${draft.name}`}
      wrapStyle={wide ? styles.draftWrapWide : undefined} style={[styles.draftCard, wide && styles.draftCardWide]} scaleTo={0.97}
    >
      <View style={styles.draftThumb}>
        {thumb ? <Image source={{ uri: thumb }} style={styles.fill} /> : <Ionicons name="image-outline" size={22} color={colors.accent} />}
        <View style={styles.draftBadge}>
          <Ionicons name={icon} size={12} color="#fff" />
        </View>
      </View>
      <View style={styles.draftBody}>
        <Text style={styles.draftTitle} numberOfLines={2}>{draft.name}</Text>
        <Text style={styles.draftMeta} numberOfLines={1}>{filledCount(draft.cfg)} фото · {formatDraftDate(draft.savedAt)}</Text>
        <Text style={styles.draftContinue}>Продолжить</Text>
      </View>
      <Pressable onPress={onDelete} hitSlop={10} accessibilityRole="button" accessibilityLabel="Удалить черновик" style={styles.draftDelete}>
        <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
      </Pressable>
    </ScalePressable>
  );
}
