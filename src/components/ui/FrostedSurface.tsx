import { BlurView } from 'expo-blur';
import { createContext, useContext, type RefObject, type ComponentRef } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

export const FrostedTargetContext = createContext<RefObject<ComponentRef<typeof View> | null> | undefined>(undefined);

export function FrostedBackground() {
  const target = useContext(FrostedTargetContext);
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <BlurView tint="systemThinMaterialLight" intensity={42} blurTarget={target} blurMethod={target ? 'dimezisBlurViewSdk31Plus' : 'none'} style={StyleSheet.absoluteFill} />
    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(250,246,239,0.48)' }]} />
  </View>;
}

export function FrostedSurface({ children, style, ...props }: ViewProps) {
  return <View {...props} style={[{ overflow: 'hidden' }, style]}><FrostedBackground />{children}</View>;
}
