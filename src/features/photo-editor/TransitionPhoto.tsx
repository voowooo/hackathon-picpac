import { useEffect, useState } from 'react';
import { Animated, Easing, Image, StyleSheet } from 'react-native';
import { useReducedMotion } from './useReducedMotion';

type Layer = { id: number; uri: string; initial: boolean; fade: Animated.Value };

/** Keep the current bitmap mounted until the next bitmap is decoded and faded in. */
export function TransitionPhoto({ uri, originalUri, comparing, style }: {
  uri: string; originalUri?: string; comparing: boolean;
  style: React.ComponentProps<typeof Animated.View>['style'];
}) {
  const reducedMotion = useReducedMotion();
  const [stack, setStack] = useState(() => ({ uri, nextId: 1, layers: [{ id: 0, uri, initial: true, fade: new Animated.Value(1) }] as Layer[] }));
  if (stack.uri !== uri) {
    // Preserve the loaded base even if undo/redo is tapped faster than images decode.
    const kept = stack.layers.length > 1 ? [stack.layers[0], stack.layers[stack.layers.length - 1]] : stack.layers;
    setStack({ uri, nextId: stack.nextId + 1, layers: [...kept, { id: stack.nextId, uri, initial: false, fade: new Animated.Value(0) }] });
  }
  return <Animated.View style={style} pointerEvents="none">
    {stack.layers.map((layer, index) => <PhotoLayer key={layer.id} layer={layer} reducedMotion={reducedMotion} opacity={layerOpacity(stack.layers, index)} onVisible={() => {
      setStack(current => current.layers[current.layers.length - 1]?.id === layer.id && current.layers.length > 1
        ? { ...current, layers: [layer] } : current);
    }} />)}
    {/* Comparison is instant, with both bitmaps already mounted; it never changes the result stack. */}
    {originalUri && <Image source={{ uri: originalUri }} style={[StyleSheet.absoluteFill, { opacity: comparing ? 1 : 0 }]} resizeMode="cover" fadeDuration={0} />}
  </Animated.View>;
}

function layerOpacity(layers: Layer[], index: number) {
  return layers.slice(index + 1).reduce<Animated.Value | Animated.AnimatedMultiplication>((opacity, next) =>
    Animated.multiply(opacity, next.fade.interpolate({ inputRange: [0, .5, 1], outputRange: [1, 1, 0] })), layers[index].fade);
}

function PhotoLayer({ layer, reducedMotion, onVisible, opacity }: { layer: Layer; reducedMotion: boolean; onVisible: () => void; opacity: ReturnType<typeof layerOpacity> }) {
  const fade = layer.fade;
  useEffect(() => () => fade.stopAnimation(), [fade]);
  return <Animated.Image source={{ uri: layer.uri }} testID="editor-photo-layer" resizeMode="cover" fadeDuration={0}
    style={[StyleSheet.absoluteFill, { opacity }]}
    onLoad={() => {
      Animated.timing(fade, { toValue: 1, duration: reducedMotion || layer.initial ? 0 : 280, easing: Easing.inOut(Easing.cubic), useNativeDriver: true, isInteraction: false })
        .start(({ finished }) => { if (finished) onVisible(); });
    }}
  />;
}
