import { StyleSheet } from 'react-native';
export const arStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#172620' },
  top: { position: 'absolute', left: 18, right: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(20,32,28,.8)' },
  badge: { color: '#fff', fontSize: 12, fontWeight: '600', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, overflow: 'hidden', backgroundColor: 'rgba(20,32,28,.8)' },
  bottom: { position: 'absolute', left: 16, right: 16, zIndex: 10, borderRadius: 24, padding: 16, gap: 12, backgroundColor: 'rgba(20,32,28,.9)' },
  hint: { color: '#fff', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  sub: { color: '#CBD5CB', fontSize: 11, lineHeight: 16, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  size: { flex: 1, alignItems: 'center', gap: 3 },
  sizeText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  primary: { backgroundColor: '#DD5757', borderRadius: 16, minHeight: 46, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', flex: 1 },
  secondary: { borderRadius: 16, minHeight: 46, paddingHorizontal: 14, backgroundColor: '#FFFFFF18', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  poster: { position: 'absolute', top: 0, left: 0, shadowColor: '#000', shadowOpacity: .3, shadowRadius: 7, shadowOffset: { width: 2, height: 4 }, elevation: 5 },
  reticle: { position: 'absolute', width: 46, height: 46, borderRadius: 13, borderWidth: 1, borderColor: '#FFFFFFB3' },
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
});
