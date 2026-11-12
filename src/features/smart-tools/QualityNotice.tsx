import { Notice } from '../../components/feedback';
import type { Photo } from '../../types';
import { formatListedPhotoNumbers } from '../../utils/format';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { smartStyles } from './smart-tools.styles';

export function QualityBadge({ photo, index }: { photo: Photo; index?: number }) {
  if (!photo.quality?.issues.length) return null;
  const noun = index != null ? `фото ${index + 1}` : "фото";
  return (
    <View pointerEvents="none" accessible accessibilityLabel={`Проверьте ${noun}: ${photo.quality.issues.join(", ")}`} style={smartStyles.badge}>
      <Ionicons name="warning" size={13} color="#594128" />
    </View>
  );
}

export function QualityNotice({
  photos, checking, indexFrom,
}: { photos: Photo[]; checking: number; /** Порядковые номера считаются по этому списку (по умолчанию — photos). */ indexFrom?: Photo[] }) {
  const issues = photos.filter((p) => p.quality?.issues.length);
  if (checking) return <Notice tone="info" icon="scan-outline" text={`Проверяем качество на устройстве · осталось ${checking}`} />;
  if (!issues.length) return null;
  const order = indexFrom ?? photos;
  const numbers = issues.map((p) => order.findIndex((x) => x.id === p.id) + 1);
  const listed = formatListedPhotoNumbers(numbers);
  const reasons = [...new Set(issues.flatMap((p) => p.quality!.issues))].slice(0, 3).join(" · ");
  const pronoun = numbers.length === 1 ? "его" : "их";
  return (
    <Notice
      tone="warn"
      icon="warning-outline"
      text={`Обратите внимание на ${listed}: ${reasons}. Перед печатью проверьте ${pronoun} в редакторе.`}
    />
  );
}
