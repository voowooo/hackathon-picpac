import { useRef } from 'react';
import { displayCentimeters } from './previewSize';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { arStyles as s } from './ar.styles';

export function ARControls({ native, placed, locked, widthCm, heightCm, printWidthCm, printHeightCm, notice, busy, onClose, onSizeStep, canDecrease, canIncrease, onCenter, onLock, gyro }: {
  native: boolean; placed: boolean; locked: boolean; canDecrease: boolean; canIncrease: boolean; widthCm: number; heightCm: number; printWidthCm: number; printHeightCm: number; notice?: string | null; busy?: boolean;
  onClose: () => void; onSizeStep: (direction: -1 | 1, steps?: number) => void; onCenter: () => void; onLock: () => void;
  gyro?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return <>
    <View style={[s.top, { top: insets.top + 10 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Закрыть AR-примерку" onPress={onClose} style={s.icon}><Ionicons name="close" size={23} color="#fff" /></Pressable>
      {/* <Text style={s.badge}>{native ? 'AR · привязка к стене' : gyro && locked ? 'Гироскоп · стабилизация' : 'Примерка камерой'}</Text> */}
    </View>
    <View style={[s.bottom, { bottom: insets.bottom + 12 }]}>
      {/* <Text accessibilityLiveRegion="polite" style={s.hint}>{notice || (native && !placed ? 'Медленно наведите камеру на стену и коснитесь места для постера' : locked ? (native ? 'Постер закреплён на стене' : 'Постер удерживает направление при повороте телефона') : 'Перетащите постер · размер меняется кнопками −/+')}</Text> */}
      {/* {!native && <Text style={s.sub}>{gyro && locked ? 'Повороты компенсируются. Перенос телефона вдоль стены гироскоп не отслеживает.' : 'Нажмите «Закрепить», чтобы включить удержание гироскопом.'}</Text>} */}
      <View style={s.row}>
        <SizeButton direction={-1} disabled={!!busy || !canDecrease} onStep={onSizeStep}/>
        <View style={s.size}><Text style={s.sizeText}>{displayCentimeters(widthCm)} × {displayCentimeters(heightCm)} см</Text>
        {/* <Text style={s.sub}>Размер в примерке · шаг 1 см</Text> */}
        <Text style={s.sub}>Печать: {printWidthCm} × {printHeightCm} см</Text></View>
        <SizeButton direction={1} disabled={!!busy || !canIncrease} onStep={onSizeStep}/>
      </View>
      <View style={s.row}>
        <Pressable accessibilityRole="button" accessibilityLabel="Переместить постер в центр" style={s.secondary} onPress={onCenter} disabled={busy}><Text style={s.buttonText}>В центр</Text></Pressable>
        <Pressable accessibilityRole="button" style={[s.primary, (!placed || busy) && { opacity: .45 }]} disabled={!placed || busy} onPress={onLock}><Text style={s.buttonText}>{busy ? 'Размещаем…' : locked ? 'Переместить' : 'Закрепить'}</Text></Pressable>
      </View>
    </View>
  </>;
}

function SizeButton({direction,disabled,onStep}:{direction:-1|1;disabled:boolean;onStep:(direction:-1|1,steps?:number)=>void}) {
  const longPress=useRef(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={direction===1?'Увеличить размер постера':'Уменьшить размер постера'} accessibilityHint="Нажатие — шаг 1 см, удержание — шаг 5 см" style={[s.icon,disabled&&{opacity:.35}]} disabled={disabled}
    onPressIn={()=>{longPress.current=false;}}
    onLongPress={()=>{longPress.current=true;onStep(direction,5);}}
    onPress={()=>{if(!longPress.current)onStep(direction,1);}}>
    <Ionicons name={direction===1?'add':'remove'} size={22} color="#fff"/>
  </Pressable>;
}
