import { StyleSheet } from 'react-native';

export const editorStyles = StyleSheet.create({
  screen: { backgroundColor: '#F6EFE6', paddingHorizontal: 18 },
  title: { color: '#364C49', fontSize: 18 },
  header: { width: '100%', maxWidth: 560, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, minHeight: 44 },
  icon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: '#fff' },
  done: { minHeight: 42, paddingHorizontal: 18, borderRadius: 21, backgroundColor: '#DD5757', justifyContent: 'center' },
  doneText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  stage: { backgroundColor: '#253D37', borderRadius: 22, overflow: 'hidden', alignSelf: 'center', width: '100%', maxWidth: 560, alignItems: 'center', paddingVertical: 14 },
  history: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', maxWidth: 520, alignSelf: 'center', paddingVertical: 10 },
  historyText: { flex: 1, color: '#7A8A84', fontSize: 12, textAlign: 'center' },
  compare: { backgroundColor: '#E7E4DC', minHeight: 40, paddingHorizontal: 12, borderRadius: 20, justifyContent: 'center' },
  compareText: { fontSize: 12, fontWeight: '600', color: '#364C49' },
  adjustments: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  adjustment: { flex: 1, minHeight: 42, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 14 },
  adjustmentText: { color: '#364C49', fontSize: 12, fontWeight: '600' },
  error: { color: '#A13C3C', fontSize: 13, lineHeight: 18, backgroundColor: '#F3DEDA', padding: 12, borderRadius: 12, marginBottom: 12 },
  hint: { color: '#7A8A84', fontSize: 13, lineHeight: 19, textAlign: 'center', paddingVertical: 12 },
  cropButton: { backgroundColor: '#DD5757', flex: 1, minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: .35 },
});
