import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { ScalePressable } from '../../../components/animation/ScalePressable';
import { Notice } from '../../../components/feedback/index';
import type { PicPacController } from '../../../state/usePicPacController';
import { styles } from '../../../styles/app.styles';
import { colors } from '../../../styles/theme';

export function AIStudioPanel({ controller }: { controller: PicPacController }) {
  const { cfg, selectedSlot, autoSmartArrange, openPhotoEditor, setEditorPanel } = controller;
  const slot = selectedSlot?.photoId ? selectedSlot : cfg.slots.find(s => s.photoId);
  return (
    <View>
      <Notice
        tone="ai" icon="sparkles"
        text="Бесплатные инструменты на устройстве: автоцвет, резкость, фильтры, подбор кадра и удаление однотонного фона. Фото никуда не отправляются."
      />
      <ScalePressable accessibilityRole="button" disabled={!slot} style={styles.aiRow} onPress={() => {
        if (!slot) return;
        setEditorPanel(null);
        setTimeout(() => openPhotoEditor(slot), 300);
      }}>
        <Ionicons name="sparkles-outline" size={24} color={colors.accent} />
        <View style={styles.optionBody}><Text style={styles.settingsTitle}>Открыть инструменты фото</Text><Text style={styles.settingsSummary}>Изменения видны сразу; оригинал сохраняется</Text></View>
      </ScalePressable>
      {cfg.category === 'photobook' && <ScalePressable accessibilityRole="button" style={styles.aiRow} onPress={() => { autoSmartArrange(); setEditorPanel(null); }}>
        <Ionicons name="grid-outline" size={24} color={colors.accent} />
        <View style={styles.optionBody}><Text style={styles.settingsTitle}>Умный автомакет</Text><Text style={styles.settingsSummary}>Заменит текущую раскладку: ориентация, качество и количество фото</Text></View>
      </ScalePressable>}
    </View>
  );
}
