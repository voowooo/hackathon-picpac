import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';
import { Animated, Easing, StyleSheet, View } from 'react-native';

/** A light sweep over the photo; the image and crop remain visible underneath. */
export function PhotoProcessingOverlay({ active }: { active: boolean }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const reducedMotion = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(0));
  const [sweep] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const fade = Animated.timing(opacity, {
      toValue: active ? 1 : 0, duration: reducedMotion ? 0 : active ? 180 : 320,
      easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false,
    });
    fade.start();
    if (!active || reducedMotion) return () => fade.stop();
    sweep.setValue(0); pulse.setValue(0);
    const movement = Animated.loop(Animated.timing(sweep, {
      toValue: 1, duration: 2200, easing: Easing.inOut(Easing.quad),
      useNativeDriver: true, isInteraction: false,
    }));
    const breathing = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(pulse, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
    ]));
    movement.start(); breathing.start();
    return () => { fade.stop(); movement.stop(); breathing.stop(); };
  }, [active, reducedMotion, opacity, sweep, pulse]);

  const travel = size.width + size.height * .35;
  return <Animated.View
    pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    testID="photo-processing-overlay"
    onLayout={({ nativeEvent: { layout } }) => setSize(previous => previous.width === layout.width && previous.height === layout.height ? previous : { width: layout.width, height: layout.height })}
    style={[StyleSheet.absoluteFill, appearance.clip, { opacity }]}
  >
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: reducedMotion ? .55 : pulse.interpolate({ inputRange: [0, 1], outputRange: [.35, .8] }) }]}>
      <LinearGradient colors={['rgba(255,201,163,0.2)', 'rgba(255,255,255,0.025)', 'rgba(174,229,218,0.22)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    </Animated.View>
    {!reducedMotion && <Animated.View style={{
      position: 'absolute', top: -size.height * .3, height: size.height * 1.6,
      left: -travel, width: travel * .65,
      opacity: sweep.interpolate({ inputRange: [0, .15, .8, 1], outputRange: [0, 1, 1, 0] }),
      transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [0, travel * 2.1] }) }, { rotate: '-18deg' }],
    }}>
      <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,226,202,0.12)', 'rgba(255,255,255,0.38)', 'rgba(192,239,230,0.12)', 'rgba(255,255,255,0)']} locations={[0, .28, .5, .72, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
    </Animated.View>}
    <View style={[StyleSheet.absoluteFill, appearance.edge]} />
  </Animated.View>;
}

const appearance = StyleSheet.create({
  clip: { overflow: 'hidden' },
  edge: { borderWidth: 1, borderColor: 'rgba(255,244,225,0.35)' },
});
