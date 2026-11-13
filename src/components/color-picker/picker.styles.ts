import { StyleSheet } from 'react-native';
export const pickerStyles=StyleSheet.create({
  swatches:{width:'100%',flexDirection:'row',flexWrap:'wrap',gap:10},
  swatch:{width:40,height:40,borderRadius:20,borderWidth:1,borderColor:'#D8D4CD',alignItems:'center',justifyContent:'center'},
  selected:{borderWidth:2,borderColor:'#DD5757'},
  custom:{width:42,height:42,borderRadius:21,overflow:'hidden',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#D8D4CD'},
  customFill:{position:'absolute',top:0,left:0,bottom:0,right:0,opacity:.8},
  backdrop:{flex:1,backgroundColor:'rgba(24,37,34,.38)',paddingHorizontal:20,alignItems:'center',justifyContent:'center'},
  dismiss:{position:'absolute',top:0,left:0,bottom:0,right:0},
  sheet:{width:'100%',maxWidth:390,maxHeight:'100%',backgroundColor:'#FFFCF8',borderRadius:28,padding:20,gap:14},
  header:{flexDirection:'row',alignItems:'center',gap:12},title:{fontSize:19,fontWeight:'700',color:'#364C49'},subtitle:{fontSize:12,color:'#7A8A84',marginTop:4},
  close:{width:38,height:38,borderRadius:19,backgroundColor:'#EEEAE4',alignItems:'center',justifyContent:'center'},
  body:{alignItems:'center',gap:12,paddingVertical:2},
  preview:{width:62,height:38,borderRadius:14,borderWidth:1,borderColor:'#D8D4CD',alignItems:'center',justifyContent:'center'},
  cursor:{position:'absolute',width:22,height:22,borderRadius:11,borderWidth:3,borderColor:'#fff',boxShadow:'0px 1px 4px rgba(0,0,0,0.3)'},
  label:{fontSize:13,fontWeight:'600',color:'#364C49'},slider:{height:40},track:{position:'absolute',left:12,right:12,top:10,height:20,borderRadius:10},
  quick:{flexDirection:'row',gap:12},quickButton:{minHeight:40,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:12,borderRadius:14,backgroundColor:'#EEEAE4'},dot:{width:20,height:20,borderRadius:10,borderWidth:1,borderColor:'#D8D4CD'},
  actions:{flexDirection:'row',gap:10},cancel:{minHeight:46,flex:1,alignItems:'center',justifyContent:'center',borderRadius:16,backgroundColor:'#EEEAE4'},apply:{minHeight:46,flex:1.4,alignItems:'center',justifyContent:'center',borderRadius:16,backgroundColor:'#DD5757'},applyText:{fontSize:14,fontWeight:'700',color:'#fff'},
});
