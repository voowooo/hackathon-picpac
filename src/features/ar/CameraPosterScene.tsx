import { CameraView } from 'expo-camera';
import { useCallback, useRef, useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ARControls } from './ARControls';
import { PosterArtwork } from './PosterArtwork';
import { arStyles as s } from './ar.styles';
import { moveQuad, quadCenter, quadMatrix, resizeQuadDimensions, type Quad } from './geometry';
import { useGyroAnchor } from './useGyroAnchor';
import { stepPreviewSize, samePreviewSize } from './previewSize';
import type { PosterSceneProps } from './types';

export function CameraPosterScene({ photoUri, widthCm, heightCm, finish, onClose }: PosterSceneProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [reference]=useState(()=>({widthCm,heightCm}));
  const [format,setFormat]=useState(()=>({widthCm,heightCm}));
  const liveFormat=useRef(format);
  const baseW = Math.min(width * .68, height * .38 * reference.widthCm / reference.heightCm), baseH = baseW * reference.heightCm / reference.widthCm;
  const centered = (): Quad => {
    const x = width / 2, y = height * .4;
    return [{ x: x - baseW / 2, y: y - baseH / 2 }, { x: x + baseW / 2, y: y - baseH / 2 }, { x: x + baseW / 2, y: y + baseH / 2 }, { x: x - baseW / 2, y: y + baseH / 2 }];
  };
  const [quad, setQuad] = useState<Quad | null>(centered);
  const current = useRef<Quad | null>(null);
  const [locked, setLocked] = useState(false);
  const publish = useCallback((next: Quad | null) => { current.current = next; setQuad(next); }, []);
  const lost = useCallback(() => setLocked(false), []);
  const gyro = useGyroAnchor(width, height, publish, lost);
  const busy = gyro.status === 'starting';
  const gesture = useRef({ active: false, x: 0, y: 0, quad: null as Quad | null });
  const resizedCenter=()=>resizeQuadDimensions(centered(),liveFormat.current.widthCm/reference.widthCm,liveFormat.current.heightCm/reference.heightCm);
  const editQuad = () => current.current ?? quad ?? resizedCenter();
  const begin = (e: GestureResponderEvent) => {
    const touches=e.nativeEvent.touches,p=touches[0];
    if (!p || touches.length!==1 || busy || locked) return;
    const q=editQuad(); publish(q);
    gesture.current = { active: true, x:p.pageX, y:p.pageY, quad:q };
  };
  const move = (e: GestureResponderEvent) => {
    const touches=e.nativeEvent.touches,p=touches[0],g=gesture.current;
    if (touches.length!==1) {g.active=false;return;}
    if (!p || busy || locked || !g.active || !g.quad) return;
    let next=moveQuad(g.quad,p.pageX-g.x,p.pageY-g.y);
    const center=quadCenter(next);
    next=moveQuad(next,Math.max(16,Math.min(width-16,center.x))-center.x,Math.max(insets.top+60,Math.min(height-insets.bottom-245,center.y))-center.y);
    publish(next);
  };
  const changeSize = (direction: -1 | 1, steps = 1) => {
    const previous=liveFormat.current,next=stepPreviewSize(previous,reference,direction,steps);
    if(busy || samePreviewSize(next,previous)) return;
    const horizontal=next.widthCm/previous.widthCm,vertical=next.heightCm/previous.heightCm;
    if(locked) gyro.resize(horizontal,vertical);
    else publish(resizeQuadDimensions(editQuad(),horizontal,vertical));
    liveFormat.current=next;setFormat(next);
  };
  const toggleLock = async () => {
    if (locked) { gyro.release(); setLocked(false); if (!quad) publish(resizedCenter()); return; }
    const q = editQuad();
    if (await gyro.pin(q)) { publish(q); setLocked(true); }
  };
  const renderW=baseW*format.widthCm/reference.widthCm,renderH=baseH*format.heightCm/reference.heightCm;
  const matrix = quad ? quadMatrix(quad, renderW, renderH) : null;
  return <View style={s.screen}>
    <CameraView style={StyleSheet.absoluteFill} facing="back" zoom={0} videoStabilizationMode="off" selectedLens={Platform.OS === 'ios' ? 'AVCaptureDeviceTypeBuiltInWideAngleCamera' : undefined} />
    {matrix && <View pointerEvents="none" style={[s.poster, { width: renderW, height: renderH, transformOrigin: '0px 0px', transform: [{ matrix }] }]}>
      <PosterArtwork uri={photoUri} width={renderW} height={renderH} widthCm={format.widthCm} finish={finish} />
    </View>}
    <View style={StyleSheet.absoluteFill} onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderGrant={begin} onResponderMove={move} onResponderRelease={() => { gesture.current.active = false; }} onResponderTerminate={() => { gesture.current.active = false; }} />
    <ARControls native={false} gyro={gyro.status === 'ready'} placed locked={locked} widthCm={format.widthCm} heightCm={format.heightCm} printWidthCm={reference.widthCm} printHeightCm={reference.heightCm} canDecrease={!samePreviewSize(stepPreviewSize(format,reference,-1),format)} canIncrease={!samePreviewSize(stepPreviewSize(format,reference,1),format)} busy={busy}
      notice={gyro.message || (busy ? 'Стабилизируем…' : locked && !quad ? 'Повернитесь к постеру или нажмите «В центр»' : null)} onClose={onClose}
      onSizeStep={changeSize} onCenter={() => { gyro.release(); setLocked(false); publish(resizedCenter()); }} onLock={() => void toggleLock()} />
  </View>;
}
