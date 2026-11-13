import { Notice } from '../../components/feedback';
import type { Photo } from '../../types';
import { formatListedPhotoNumbers } from '../../utils/format';
export function QualityNotice({
  photos, checking, indexFrom,
}: { photos: Photo[]; checking: number; /** Порядковые номера считаются по этому списку (по умолчанию — photos). */ indexFrom?: Photo[] }) {
  const issues = photos.filter((p) => p.quality?.issues.length);
  if (checking) return <Notice tone="info" icon="scan-outline" text={`Проверяем качество на устройстве · осталось ${checking}`} />;
  if (!issues.length) return null;
  const order = indexFrom ?? photos;
  const numbers = issues.map((p) => order.findIndex((x) => x.id === p.id) + 1);
  const listed = formatListedPhotoNumbers(numbers);
  return (
    <Notice
      tone="warn"
      icon="warning-outline"
      text={`${listed.charAt(0).toUpperCase() + listed.slice(1)} — низкого качества.`}
    />
  );
}
