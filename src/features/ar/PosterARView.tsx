import { Ionicons } from '@expo/vector-icons';
import { useCameraPermissions } from 'expo-camera';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { arCapabilities, ExpoAr } from '../../services/ar';
import { selectedPosterFormat } from './posterFormats';
import type { PrintFinish } from '../../types';
import { CameraPosterScene } from './CameraPosterScene';
import { NativePosterScene } from './NativePosterScene';
import { arStyles as s } from './ar.styles';

export function PosterARView({ visible, onClose, photoUri, sizeId, landscape, finish }: {
  visible: boolean; onClose: () => void; photoUri?: string; sizeId: string; landscape: boolean; finish: PrintFinish;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const insets = useSafeAreaInsets();
  const selected=selectedPosterFormat(sizeId,landscape);
  const props = { photoUri, widthCm:selected.widthCm, heightCm:selected.heightCm, finish, onClose };
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
    <View style={s.screen}>
      {visible && (permission?.granted ? (arCapabilities?.arSupported && ExpoAr ? <NativePosterScene {...props} /> : <CameraPosterScene {...props} />) : <>
        <View style={s.gate}>
          <Ionicons name="camera-outline" size={42} color="#fff" />
          <Text style={s.sizeText}>Примерьте постер у себя дома</Text>
          <Text style={s.hint}>{!permission ? 'Проверяем доступ к камере…' : permission.canAskAgain ? 'Камера нужна для размещения постера. Снимки с камеры не отправляются на сервер.' : 'Разрешите доступ к камере для PicPac в настройках устройства.'}</Text>
          {permission?.canAskAgain && <Pressable accessibilityRole="button" onPress={() => void requestPermission()} style={[s.primary, { flex: 0 }]}><Text style={s.buttonText}>Разрешить камеру</Text></Pressable>}
        </View>
        <View style={[s.top, { top: insets.top + 10 }]}><Pressable accessibilityRole="button" accessibilityLabel="Закрыть AR-примерку" style={s.icon} onPress={onClose}><Ionicons name="close" size={23} color="#fff" /></Pressable></View>
      </>)}
    </View>
  </Modal>;
}
