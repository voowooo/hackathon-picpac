import { StyleSheet } from 'react-native';

export const builderStyles = StyleSheet.create({
  dock: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 25, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,.72)', borderBottomWidth: 0 },
  footer: { backgroundColor: 'transparent', borderTopWidth: 0, paddingTop: 8, paddingHorizontal: 20 },
  disclosure: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 68, paddingHorizontal: 16, paddingVertical: 12 },
  disclosureIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3E8DE' },
  disclosureBody: { flex: 1, gap: 3 },
  disclosureTitle: { fontSize: 14, fontWeight: '700', color: '#364C49' },
  disclosureHint: { fontSize: 12, color: '#7A8A84' },
});
