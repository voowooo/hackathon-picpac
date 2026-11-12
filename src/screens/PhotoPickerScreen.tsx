import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { ScreenHeader, StepBar } from '../components/navigation/index';
import { PrimaryButton } from '../components/ui/index';
import type { PicPacController } from '../state/usePicPacController';
import { styles } from '../styles/app.styles';
import { colors, spacing } from '../styles/theme';
import { QualityBadge, QualityNotice } from '../features/smart-tools/QualityNotice';

export function PhotoPickerScreen({ controller }: { controller: PicPacController }) {
  const { clearPhotos, goToBuilder, insets, photos, pickMore, removePhoto, setScreen, width } = controller;

  const thumb = (width - spacing.lg * 2 - 8 * 3) / 4;
  return (
    <View style={styles.flex}>
      <ScreenHeader title="Фотографии" onBack={() => setScreen("builder")} />
      <StepBar step={1} />
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: spacing.xl }]} showsVerticalScrollIndicator={false}>
        <QualityNotice photos={photos} checking={controller.qualityChecking} />
        {photos.length === 0 ? (
          <View style={styles.dropzone}>
            <View style={styles.dropIcon}>
              <Ionicons name="cloud-upload-outline" size={32} color={colors.accent} />
            </View>
            <Text style={styles.dropTitle}>Добавьте ваши фото</Text>
            <Text style={styles.dropText}>Можно выбрать сразу несколько. Макет соберётся автоматически.</Text>
            <PrimaryButton label="Выбрать из галереи" icon="images-outline" onPress={pickMore} />
          </View>
        ) : (
          <>
            <View style={styles.pickedHeader}>
              <Text style={styles.pickedTitle}>Выбрано: {photos.length}</Text>
              <Pressable onPress={clearPhotos} hitSlop={8}>
                <Text style={styles.linkText}>Очистить</Text>
              </Pressable>
            </View>
            <View style={styles.thumbGrid}>
              <Pressable onPress={pickMore} style={[styles.thumbAdd, { width: thumb, height: thumb }]}>
                <Ionicons name="add" size={26} color={colors.accent} />
                <Text style={styles.trayAddText}>Добавить</Text>
              </Pressable>
              {photos.map((p, index) => (
                <View key={p.id} style={[styles.thumb, { width: thumb, height: thumb }]}>
                  <Image source={{ uri: p.uri }} style={styles.fill} />
                  <QualityBadge photo={p} index={index} />
                  <Pressable style={styles.thumbRemove} onPress={() => removePhoto(p.id)} hitSlop={6}>
                    <Ionicons name="close" size={13} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
      <View style={[styles.footerBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <PrimaryButton label="К макету" icon={photos.length ? "arrow-forward" : undefined} disabled={photos.length === 0} onPress={() => goToBuilder()} />
      </View>
    </View>
  );

}
