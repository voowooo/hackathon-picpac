import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { PrintFinish } from '../../types';

export const PosterArtwork = memo(function PosterArtwork({ uri, width, height, widthCm, finish }: { uri?: string; width: number; height: number; widthCm: number; finish: PrintFinish }) {
  const pxPerMm = width / (widthCm * 10);
  return <View style={{ width, height, backgroundColor: finish.marginColor, padding: finish.margin * pxPerMm, borderWidth: .6, borderColor: '#FFFFFFA6' }}>
    <View style={{ flex: 1, backgroundColor: finish.frameColor, padding: finish.frame * pxPerMm }}>
      <View style={{ flex: 1, backgroundColor: '#F0EDE6', overflow: 'hidden' }}>{uri && <Image source={{ uri }} fadeDuration={0} resizeMode="cover" style={StyleSheet.absoluteFill} />}</View>
    </View>
    <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,.075)', 'rgba(255,255,255,0)', 'rgba(12,20,16,.08)']} style={StyleSheet.absoluteFill} />
  </View>;
});
