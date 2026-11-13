import { bookLeafCorners } from '../../../styles/bookSurface';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

/** Lighting stays inside the physical leaf, so live pages and turn snapshots
 * have identical edges without changing clipping, transforms or hit targets. */
export const BookPageDepth = memo(function BookPageDepth({ side, style }: { side: 'left' | 'right' | 'cover'; style?: ViewProps['style'] }) {
  const left = side !== 'right';
  const clear = 'rgba(55,42,28,0)';
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, bookLeafCorners(side), {overflow:'hidden'}, style]}>
    <LinearGradient colors={left ? ['rgba(55,42,28,0.13)', clear] : [clear, 'rgba(55,42,28,0.13)']} start={{x:0,y:0}} end={{x:1,y:0}} style={[edge.outer, left ? {left:0} : {right:0}, side==='cover'&&{width:12}]} />
    {side==='cover'&&<LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.18)']} start={{x:0,y:0}} end={{x:1,y:0}} style={[edge.outer,{right:0,width:4}]} />}
    <LinearGradient colors={[clear,'rgba(55,42,28,0.16)']} style={edge.bottom}/>
    <View style={edge.topHighlight}/>
    <View style={edge.rim}/>
    {side!=='cover'&&<View style={edge.paperLine}/>}
  </View>;
});

const edge=StyleSheet.create({
  outer:{position:'absolute',top:0,bottom:0,width:8},
  bottom:{position:'absolute',bottom:0,left:0,right:0,height:6},
  topHighlight:{position:'absolute',top:0,left:1,right:1,height:1,backgroundColor:'rgba(255,255,255,0.55)'},
  rim:{position:'absolute',left:1,right:1,bottom:1,height:1,backgroundColor:'rgba(255,255,255,0.5)'},
  paperLine:{position:'absolute',left:2,right:2,bottom:3,height:.5,backgroundColor:'rgba(255,255,255,0.4)'},
});
