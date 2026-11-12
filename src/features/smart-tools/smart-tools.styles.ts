import { StyleSheet } from 'react-native';

export const smartStyles = StyleSheet.create({
  panel: { gap: 12, paddingBottom: 20 },
  title: { color: '#fff', fontSize: 17, fontWeight: '700', marginTop: 8 },
  text: { color: '#fff', fontSize: 13, fontWeight: '600', flexShrink: 1 },
  hint: { color: '#BCCAC4', fontSize: 12, lineHeight: 17, marginTop: 3 },
  quality: { backgroundColor: '#FFFFFF0C', borderRadius: 16, padding: 12, flexDirection: 'row', gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tool: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: '#FFFFFF26', backgroundColor: '#FFFFFF0C' },
  cell: { flexGrow: 1, flexBasis: '46%' },
  disabled: { opacity: 0.4 },
  badge: { position: 'absolute', bottom: 5, left: 5, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4C98C' },
});
