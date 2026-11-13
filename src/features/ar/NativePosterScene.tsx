import type { ArViewHandle, ProjectionEvent } from '@stewmore/expo-ar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { ExpoAr } from '../../services/ar';
import { ARControls } from './ARControls';
import { PosterArtwork } from './PosterArtwork';
import { arStyles as s } from './ar.styles';
import { moveQuad, quadCenter, quadMatrix, resizeQuadDimensions, wallCorners, type Point, type Quad } from './geometry';
import { useProjectionFrames } from './useProjectionFrames';
import { stepPreviewSize, samePreviewSize, type PreviewSize } from './previewSize';
import type { PosterSceneProps } from './types';

type Placement = { ids: string[]; transform: number[]; format: PreviewSize };
export function NativePosterScene({ photoUri, widthCm, heightCm, finish, onClose }: PosterSceneProps) {
  const { width, height } = useWindowDimensions();
  const ar = useRef<ArViewHandle | null>(null);
  const placement = useRef<Placement | null>(null);
  const generation = useRef({ version: 0 });
  const operation = useRef(false);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reference]=useState(()=>({widthCm,heightCm}));
  const [format,setFormat]=useState(()=>({widthCm,heightCm}));
  const liveFormat=useRef(format);
  const [quad, setQuad] = useState<Quad | null>(null);
  const lastProjection = useRef<Quad | null>(null);
  const lastProjectionTime = useRef(0);
  const currentQuad = useRef<Quad | null>(null);
  const gesture = useRef({ active: false, start: { x: 0, y: 0 }, last: { x: 0, y: 0 }, quad: null as Quad | null, moved: false });
  const updateQuad = useCallback((next: Quad | null) => { currentQuad.current = next; setQuad(next); }, []);
  const projectFrame = useProjectionFrames(updateQuad);
  const remove = async (view: ArViewHandle, ids: string[]) => { await Promise.allSettled(ids.map(id => view.removeAnchor(id))); };

  useEffect(() => {
    const view = ar.current;
    const lifetime = generation.current;
    return () => {
      lifetime.version++;
      if (view && placement.current) void remove(view, placement.current.ids);
    };
  }, []);

  // Transactional placement: retain the existing wall anchor until all new
  // corners exist. A failed raycast never deletes the previous placement.
  const placeWorld = async (transform: number[], nextFormat: PreviewSize) => {
    const view = ar.current;
    if (operation.current) return;
    if (!view?.addAnchorAtWorld) { gesture.current.active = false; setNotice('Эта сборка не поддерживает привязку к стене. Нужна актуальная AR-сборка приложения.'); return; }
    projectFrame(currentQuad.current, true);
    operation.current = true; setBusy(true);
    const token = ++generation.current.version, created: string[] = [];
    try {
      const corners = wallCorners(transform, nextFormat.widthCm / 100, nextFormat.heightCm / 100);
      for (const corner of corners) {
        const anchor = await view.addAnchorAtWorld(corner);
        if (!anchor) throw new Error('Не удалось закрепить постер. Попробуйте другое место на стене.');
        created.push(anchor.id);
      }
      if (generation.current.version !== token) { await remove(view, created); return; }
      const previous = placement.current;
      placement.current = { ids: created, transform, format: nextFormat };
      lastProjectionTime.current = performance.now();
      if(!samePreviewSize(liveFormat.current,nextFormat)) {liveFormat.current=nextFormat;setFormat(nextFormat);}
      setPlaced(true); setNotice(null);
      if (previous) await remove(view, previous.ids);
    } catch (error) {
      await remove(view, created);
      if (token === generation.current.version) {
        
        setNotice(error instanceof Error ? error.message : 'Стена пока не распознана');
        updateQuad(lastProjection.current);
      }
    } finally {
      operation.current = false; gesture.current.active = false;
      if (token === generation.current.version) setBusy(false);
    }
  };
  const placeAt = async (point: Point) => {
    const view = ar.current;
    if (!view || operation.current) return;
    const token = generation.current.version;
    try {
      const hit = await view.raycast(point.x, point.y);
      if (token !== generation.current.version) return;
      if (!hit.worldTransform || hit.target !== 'plane') throw new Error('Не видно стены. Добавьте света и медленно проведите камерой по поверхности.');
      await placeWorld(hit.worldTransform, liveFormat.current);
    } catch (error) {
      if (token !== generation.current.version) return;
      gesture.current.active = false; updateQuad(lastProjection.current);
      
      setNotice(error instanceof Error ? error.message : 'Не удалось найти стену');
    }
  };
  const onProjection = (event: { nativeEvent: ProjectionEvent }) => {
    const active = placement.current;
    if (!active) return;
    const points = active.ids.map(id => event.nativeEvent.points.find(p => p.id === id));
    if (points.some(p => !p)) {
      // Replacement can emit an incomplete set briefly; do not flash or retain stale corners indefinitely.
      if (!operation.current && !gesture.current.active && performance.now()-lastProjectionTime.current>200) projectFrame(null);
      return;
    }
    if (points.some(p => !p!.inFront || !Number.isFinite(p!.x) || !Number.isFinite(p!.y))) {
      lastProjection.current = null;
      if (!gesture.current.active) projectFrame(null);
      return;
    }
    const next = points.map(p => ({ x: p!.x, y: p!.y })) as Quad;
    lastProjection.current = next; lastProjectionTime.current = performance.now();
    if (!gesture.current.active && !operation.current) projectFrame(next);
  };
  const begin = (e: GestureResponderEvent) => {
    const touches=e.nativeEvent.touches,p=touches[0];
    if (!p || touches.length!==1 || operation.current || locked) return;
    projectFrame(currentQuad.current,true);
    const point={x:p.pageX,y:p.pageY};
    gesture.current={active:true,start:point,last:point,quad:currentQuad.current,moved:false};
  };
  const move = (e: GestureResponderEvent) => {
    const g=gesture.current,touches=e.nativeEvent.touches,p=touches[0];
    if(touches.length!==1) {
      if(g.active) {g.active=false;projectFrame(lastProjection.current,true);}
      return;
    }
    if(!p || !g.active || operation.current || locked) return;
    g.last={x:p.pageX,y:p.pageY};
    if(g.quad) {
      const dx=p.pageX-g.start.x,dy=p.pageY-g.start.y;
      g.moved=g.moved||Math.hypot(dx,dy)>5;
      updateQuad(moveQuad(g.quad,dx,dy));
    }
  };
  const end = () => {
    const g=gesture.current;
    if(!g.active || operation.current) return;
    if(g.moved && currentQuad.current) void placeAt(quadCenter(currentQuad.current));
    else void placeAt(g.last);
  };
  const changeSize = (direction: -1 | 1, steps = 1) => {
    const previous=liveFormat.current,next=stepPreviewSize(previous,reference,direction,steps);
    if(operation.current || samePreviewSize(next,previous)) return;
    if(placement.current) {
      if(currentQuad.current) updateQuad(resizeQuadDimensions(currentQuad.current,next.widthCm/previous.widthCm,next.heightCm/previous.heightCm));
      void placeWorld(placement.current.transform,next);
    } else {liveFormat.current=next;setFormat(next);}
  };
  const NativeView = ExpoAr?.ExpoArView;
  const renderW = 320, renderH = renderW * format.heightCm / format.widthCm;
  const matrix = quad ? quadMatrix(quad, renderW, renderH) : null;
  return <View style={s.screen}>
    {NativeView && <NativeView ref={ar} style={StyleSheet.absoluteFill} planeDetection="vertical" emitProjections onProjection={onProjection}
      onError={event => setNotice(event.nativeEvent.message)}
      onTrackingStateChange={event => { if (event.nativeEvent.state === 'normal') setNotice(null); else { projectFrame(null); lastProjection.current = null; setNotice('Трекинг нестабилен. Двигайте телефон медленнее и добавьте света.'); } }} />}
    {matrix && <View pointerEvents="none" style={[s.poster, { width: renderW, height: renderH, transformOrigin: '0px 0px', transform: [{ matrix }] }]}>
      <PosterArtwork uri={photoUri} width={renderW} height={renderH} widthCm={format.widthCm} finish={finish} />
    </View>}
    {!placed && <View pointerEvents="none" style={[s.reticle, { left: width / 2 - 23, top: height * .4 - 23 }]} />}
    <View style={StyleSheet.absoluteFill} onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderGrant={begin} onResponderMove={move} onResponderRelease={end} onResponderTerminate={() => { gesture.current.active = false; projectFrame(lastProjection.current,true); }} />
    <ARControls native placed={placed} locked={locked} widthCm={format.widthCm} heightCm={format.heightCm} printWidthCm={reference.widthCm} printHeightCm={reference.heightCm} canDecrease={!samePreviewSize(stepPreviewSize(format,reference,-1),format)} canIncrease={!samePreviewSize(stepPreviewSize(format,reference,1),format)} notice={notice} busy={busy} onClose={onClose} onSizeStep={changeSize}
      onCenter={() => { setLocked(false); void placeAt({ x: width / 2, y: height * .4 }); }} onLock={() => setLocked(value => !value)} />
  </View>;
}
