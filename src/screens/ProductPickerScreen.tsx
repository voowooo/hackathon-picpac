import { Ionicons } from "@expo/vector-icons";
import { FlatList, Image, Pressable, ScrollView, Text, View } from "react-native";
import { ScreenHeader } from '../components/navigation/index';
import { PrimaryButton } from '../components/ui/index';
import { PRODUCT_TABS } from '../config/catalog';
import { ProductChoiceCard } from '../features/catalog/ProductChoiceCard';
import type { PicPacController } from '../state/usePicPacController';
import { styles } from '../styles/app.styles';
import { colors, spacing } from '../styles/theme';
import { QualityBadge, QualityNotice } from '../features/smart-tools/QualityNotice';

export function ProductPickerScreen({ controller }: { controller: PicPacController }) {
  const { chooseUploadedProduct, insets, photos, pickMore, removePhoto, setScreen, width } = controller;
  return (
    <View style={styles.flex}>
      <ScreenHeader title="Что напечатать" onBack={() => setScreen("home")} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.productChoiceContent, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.uploadedPhotosSummary}>
          <Ionicons name="images-outline" size={26} color={colors.text} />
          <View style={styles.flex}>
            <Text style={styles.settingsTitle}>{photos.length ? `Фото загружены · ${photos.length}` : "Добавьте фотографии"}</Text>
            <Text style={styles.settingsSummary}>{photos.length ? "Выберите, во что их превратить" : "Затем выберите формат печати"}</Text>
          </View>
          {photos.length ? <Ionicons name="checkmark-circle" size={24} color={colors.safe} /> : null}
        </View>
        <QualityNotice photos={photos} checking={controller.qualityChecking} />
        {photos.length ? (
          <FlatList
            horizontal data={photos} keyExtractor={(photo) => photo.id} showsHorizontalScrollIndicator={false}
            style={styles.uploadedPhotoList} contentContainerStyle={styles.uploadedPhotoListContent}
            initialNumToRender={6} maxToRenderPerBatch={8}
            renderItem={({ item, index }) => (
              <View style={styles.uploadedPhotoItem}>
                <Image source={{ uri: item.uri }} style={styles.uploadedPhotoPreview} resizeMode="cover" accessibilityLabel={`Выбранное фото ${index + 1}`} />
                <QualityBadge photo={item} index={index} />
                <Pressable
                  style={styles.uploadedPhotoRemove} hitSlop={8} onPress={() => removePhoto(item.id)}
                  accessibilityRole="button" accessibilityLabel={`Убрать фото ${index + 1} из выбранных`}
                >
                  <Ionicons name="close" size={16} color="#fff" />
                </Pressable>
              </View>
            )}
          />
        ) : null}
        <View style={styles.uploadedPhotoAdd}>
          <PrimaryButton label="Добавить ещё фото" icon="add" variant="secondary" onPress={pickMore} />
        </View>
        <Text style={styles.productChoiceTitle}>Ваши фото, ваш формат</Text>
        <Text style={styles.productChoiceHint}>Сохраните моменты в книге, отправьте открытку или украсьте дом.</Text>
        <View style={styles.productChoiceGrid}>
          {PRODUCT_TABS.map((product, index) => (
            <ProductChoiceCard key={product.id} product={product} index={index} disabled={photos.length === 0} onPress={() => chooseUploadedProduct(product.id)} style={{ width: (Math.min(width, 640) - spacing.lg * 2 - 12) / 2, minHeight: 178 }} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
