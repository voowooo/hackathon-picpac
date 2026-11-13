import { DeviceMotion } from 'expo-sensors';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { resizeQuadDimensions, type Quad } from './geometry';
import { anchorRays, identityRotation, projectStablePoster, resizeRayDimensions, smoothRotation, type RayQuad } from './gyroMath';

import { createRelativeMotion } from './relativeMotion';

type Status = 'idle' | 'starting' | 'ready' | 'unavailable';
export function useGyroAnchor(width: number, height: number, onProjection: (quad: Quad | null) => void, onLost: () => void) {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const viewport = useRef({ width, height });
  const callbacks = useRef({ onProjection, onLost });
  const live = useRef({ rotation: identityRotation(), displayed: identityRotation(), rays: null as RayQuad | null, placed: null as Quad | null, published: null as Quad | null,
    subscription: null as ReturnType<typeof DeviceMotion.addListener> | null, lastSample: 0, lastFrame: 0, frame: 0,
    ready: false, mounted: true, generation: 0, timer: undefined as ReturnType<typeof setTimeout> | undefined,
    resolve: undefined as ((value: boolean) => void) | undefined });
  const stop = useCallback(() => {
    const l = live.current;
    l.generation++; l.subscription?.remove(); l.subscription = null;
    if (l.timer) clearTimeout(l.timer);
    if (l.frame) cancelAnimationFrame(l.frame);
    l.resolve?.(false); l.resolve = undefined; l.timer = undefined;
    l.ready = false; l.rays = null; l.placed = null; l.published = null; l.lastSample = 0; l.lastFrame = 0; l.frame = 0;
    l.rotation = identityRotation(); l.displayed = identityRotation();
  }, []);
  useEffect(() => {
    const previous = viewport.current;
    viewport.current = { width, height }; callbacks.current = { onProjection, onLost };
    // Screen resizing changes camera intrinsics. Do not silently warp an existing anchor.
    if ((previous.width !== width || previous.height !== height) && live.current.rays) {
      live.current.rays = null; live.current.placed = null;
      onLost(); setMessage('Размер экрана изменился. Закрепите постер заново.');
    }
  }, [width, height, onProjection, onLost]);
  useEffect(() => {
    const l = live.current; l.mounted = true;
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active' || (state === 'inactive' && !l.ready)) return;
      const wasPinned = !!l.rays;
      stop(); setStatus('idle');
      if (wasPinned) { setMessage('После возврата закрепите постер заново.'); callbacks.current.onLost(); }
    });
    return () => { l.mounted = false; stop(); listener.remove(); };
  }, [stop]);

  const start = async () => {
    const l = live.current;
    if (l.ready && l.subscription) return true;
    const token = ++l.generation;
    setStatus('starting'); setMessage(null);
    try {
      const permission = await DeviceMotion.requestPermissionsAsync();
      if (!l.mounted || token !== l.generation) return false;
      if (!permission.granted) throw new Error('Разрешите датчики движения в настройках телефона, чтобы стабилизировать постер.');
      if (!await DeviceMotion.isAvailableAsync()) throw new Error('Датчики движения недоступны на этом устройстве.');
      if (!l.mounted || token !== l.generation) return false;
      DeviceMotion.setUpdateInterval(16);
      const motion = createRelativeMotion(Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web', true);
      const render = (time: number) => {
        if (!l.mounted || token !== l.generation) return;
        const dt = l.lastFrame ? (time - l.lastFrame) / 1000 : 1/60; l.lastFrame = time;
        if (l.rays && performance.now() - l.lastSample > 500) {
          stop(); setStatus('unavailable'); callbacks.current.onLost();
          setMessage('Данные движения прервались. Закрепите постер заново.'); return;
        }
        l.displayed = smoothRotation(l.displayed, l.rotation, dt);
        if (l.rays && l.placed) {
          const view = viewport.current;
          const next = projectStablePoster(l.rays, l.displayed, view.width, view.height, l.placed);
          const previous = l.published;
          if (next ? !previous || next.some((p,i)=>Math.hypot(p.x-previous[i].x,p.y-previous[i].y)>.04) : previous !== null) {
            l.published=next; callbacks.current.onProjection(next);
          }
        }
        l.frame = requestAnimationFrame(render);
      };
      return await new Promise<boolean>(resolve => {
        l.resolve = resolve;
        l.timer = setTimeout(() => {
          if (!l.mounted || token !== l.generation) return;
          stop(); setStatus('unavailable'); setMessage('Нет данных движения. Проверьте доступ к датчикам.');
        }, 2500);
        l.subscription = DeviceMotion.addListener(sample => {
          if (!l.mounted || token !== l.generation) return;
          const update = motion.update(sample, performance.now()/1000);
          if (!update) return;
          if (update.interrupted && l.rays) {
            l.rays = null; l.placed = null; l.published = null;
            callbacks.current.onLost(); setMessage('Данные движения прервались. Закрепите постер заново.');
          }
          l.rotation = update.rotation;
          l.lastSample = performance.now();
          if (!l.ready && !update.calibrating) {
            l.displayed = l.rotation; l.ready = true; setStatus('ready');
            if (l.timer) clearTimeout(l.timer);
            l.timer = undefined; l.resolve?.(true); l.resolve = undefined;
            l.frame = requestAnimationFrame(render);
          }
        });
      });
    } catch (error) {
      if (l.mounted && token === l.generation) {
        stop(); setStatus('unavailable');
        const text = error instanceof Error ? error.message : '';
        setMessage(/^(Разрешите|Датчики)/.test(text) ? text : 'Не удалось включить датчики движения. Проверьте доступ в настройках.');
      }
      return false;
    }
  };
  const pin = async (quad: Quad) => {
    if (!await start()) return false;
    const l = live.current, view = viewport.current;
    if (!l.mounted || !l.ready) return false;
    // Anchor and first rendered pose share the exact same orientation: no initial jump.
    l.displayed = l.rotation; l.placed = quad; l.published = quad;
    l.rays = anchorRays(quad, l.displayed, view.width, view.height);
    setMessage(null); return true;
  };
  const release = () => { stop(); setStatus('idle'); setMessage(null); };
  const resize = (horizontal: number, vertical: number) => {
    const l = live.current, view = viewport.current;
    if (!l.rays || !l.placed || ![horizontal,vertical].every(n=>Number.isFinite(n)&&n>0)) return;
    l.rays = resizeRayDimensions(l.rays, horizontal, vertical); l.placed = resizeQuadDimensions(l.placed, horizontal, vertical);
    l.published = projectStablePoster(l.rays, l.displayed, view.width, view.height, l.placed);
    callbacks.current.onProjection(l.published);
  };
  return { pin, release, resize, status, message };
}
