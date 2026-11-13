import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useId, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hexColorsEqual, isDark } from '../../utils/format';
import { hexToHsv, hsvToHex, wheelColor } from './color';
import { pickerStyles as s } from './picker.styles';

type Preset = { name: string; value: string };
export function ColorField({ value, title, presets, onChange }: { value: string; title: string; presets: readonly Preset[]; onChange: (color: string) => void }) {
  const [open, setOpen] = useState(false);
  const custom=!presets.some(p=>hexColorsEqual(value,p.value));
  return <View style={s.swatches}>
    {presets.map(p=><Pressable key={p.value} accessibilityRole="button" accessibilityLabel={`${title}: ${p.name}`} accessibilityState={{selected:hexColorsEqual(value,p.value)}} onPress={()=>onChange(p.value)} style={[s.swatch,{backgroundColor:p.value},hexColorsEqual(value,p.value)&&s.selected]}>
      {hexColorsEqual(value,p.value)&&<Ionicons name="checkmark" size={19} color={isDark(p.value)?'#fff':'#364C49'}/>}
    </Pressable>)}
    <Pressable accessibilityRole="button" accessibilityLabel={`Свой цвет: ${title.toLowerCase()}`} onPress={()=>setOpen(true)} style={[s.custom,custom&&s.selected,custom&&{backgroundColor:value}]}>
      <LinearGradient colors={['#ED8A8A','#F0D596','#99D0B8','#99B5E0','#C2A1CE']} start={{x:0,y:0}} end={{x:1,y:1}} style={[s.customFill,custom&&{opacity:0}]}/>
      <Ionicons name="color-palette-outline" size={21} color={custom&&isDark(value)?'#fff':'#364C49'}/>
    </Pressable>
    {open&&<ColorPicker value={value} title={title} onClose={()=>setOpen(false)} onApply={color=>{onChange(color);setOpen(false);}}/>}
  </View>;
}

function ColorPicker({value,title,onClose,onApply}:{value:string;title:string;onClose:()=>void;onApply:(hex:string)=>void}) {
  const [hsv,setHsv]=useState(()=>hexToHsv(value));
  const {width,height}=useWindowDimensions(), insets=useSafeAreaInsets();
  const size=Math.max(160,Math.min(260,width-88,height*.34)), r=size/2-12;
  const color=hsvToHex(hsv), full=hsvToHex({...hsv,v:1});
  const choose=(e:GestureResponderEvent)=>{
    const {locationX:x,locationY:y}=e.nativeEvent;
    setHsv(previous=>({...previous,...wheelColor(x,y,size),v:previous.v===0?1:previous.v}));
  };
  const brightness=(e:GestureResponderEvent)=>setHsv(previous=>({...previous,v:Math.max(0,Math.min(1,(e.nativeEvent.locationX-12)/(size-24)))}));
  return <Modal transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
    <View style={[s.backdrop,{paddingTop:insets.top+12,paddingBottom:insets.bottom+12}]}>
      <Pressable style={s.dismiss} onPress={onClose} accessibilityLabel="Отменить выбор цвета" accessibilityRole="button"/>
      <View style={s.sheet} accessibilityViewIsModal>
        <View style={s.header}><View style={{flex:1}}><Text style={s.title}>{title}</Text><Text style={s.subtitle}>Выберите оттенок на круге</Text></View><Pressable style={s.close} accessibilityRole="button" accessibilityLabel="Закрыть выбор цвета" onPress={onClose}><Ionicons name="close" size={22} color="#364C49"/></Pressable></View>
        <ScrollView bounces={false} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
          <View style={[s.preview,{backgroundColor:color}]}><Ionicons name="color-palette-outline" size={20} color={isDark(color)?'#fff':'#364C49'}/></View>
          <View style={{width:size,height:size}} testID="color-wheel" accessibilityRole="adjustable" accessibilityLabel="Цветовой круг" aria-valuemin={0} aria-valuemax={360} aria-valuenow={Math.round(hsv.h)} accessibilityValue={{min:0,max:360,now:Math.round(hsv.h),text:`Оттенок ${Math.round(hsv.h)} градусов`}} accessibilityActions={[{name:'increment',label:'Следующий оттенок'},{name:'decrement',label:'Предыдущий оттенок'}]} onAccessibilityAction={e=>setHsv(p=>({...p,h:(p.h+(e.nativeEvent.actionName==='increment'?5:-5)+360)%360}))}
            onStartShouldSetResponder={()=>true} onMoveShouldSetResponder={()=>true} onResponderGrant={choose} onResponderMove={choose}>
            <View pointerEvents="none" style={s.dismiss}><ColorWheel size={size}/><View style={[s.cursor,{backgroundColor:full,left:size/2+Math.cos(hsv.h*Math.PI/180)*hsv.s*r-11,top:size/2+Math.sin(hsv.h*Math.PI/180)*hsv.s*r-11}]}/></View>
          </View>
          <View style={{width:size,gap:8}}><Text style={s.label}>Светлее / темнее</Text>
            <View testID="color-brightness" style={s.slider} accessibilityRole="adjustable" accessibilityLabel="Яркость цвета" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hsv.v*100)} accessibilityValue={{min:0,max:100,now:Math.round(hsv.v*100)}} accessibilityActions={[{name:'increment'},{name:'decrement'}]} onAccessibilityAction={e=>setHsv(p=>({...p,v:Math.max(0,Math.min(1,p.v+(e.nativeEvent.actionName==='increment' ? .05 : -.05)))}))}
              onStartShouldSetResponder={()=>true} onMoveShouldSetResponder={()=>true} onResponderGrant={brightness} onResponderMove={brightness}>
              <View pointerEvents="none" style={s.dismiss}><LinearGradient colors={['#000000',full]} start={{x:0,y:0}} end={{x:1,y:0}} style={s.track}/><View style={[s.cursor,{top:9,left:1+hsv.v*(size-24),backgroundColor:color}]}/></View>
            </View>
          </View>
          <View style={s.quick}>{[{name:'Белый',value:'#FFFFFF'},{name:'Чёрный',value:'#000000'}].map(p=><Pressable key={p.value} accessibilityRole="button" accessibilityLabel={p.name} style={s.quickButton} onPress={()=>setHsv(hexToHsv(p.value))}><View style={[s.dot,{backgroundColor:p.value}]}/><Text style={s.label}>{p.name}</Text></Pressable>)}</View>
        </ScrollView>
        <View style={s.actions}><Pressable style={s.cancel} onPress={onClose} accessibilityRole="button"><Text style={s.label}>Отмена</Text></Pressable><Pressable style={s.apply} onPress={()=>onApply(color)} accessibilityRole="button"><Text style={s.applyText}>Выбрать цвет</Text></Pressable></View>
      </View>
    </View>
  </Modal>;
}

const ColorWheel=memo(function ColorWheel({size}:{size:number}) {
  const id=useId().replace(/:/g,''); const c=size/2,r=c-12;
  return <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
    <Defs><RadialGradient id={id}><Stop offset="0" stopColor="#fff" stopOpacity={1}/><Stop offset="1" stopColor="#fff" stopOpacity={0}/></RadialGradient></Defs>
    {Array.from({length:120},(_,i)=>{const a=i*3*Math.PI/180,b=(i*3+3.2)*Math.PI/180;return <Path key={i} d={`M ${c} ${c} L ${c+r*Math.cos(a)} ${c+r*Math.sin(a)} A ${r} ${r} 0 0 1 ${c+r*Math.cos(b)} ${c+r*Math.sin(b)} Z`} fill={hsvToHex({h:i*3+1.5,s:1,v:1})}/>;})}
    <Circle cx={c} cy={c} r={r} fill={`url(#${id})`}/>
  </Svg>;
});
