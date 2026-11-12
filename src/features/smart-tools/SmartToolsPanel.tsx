import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { IconName, PhotoQuality } from '../../types';
import type { LocalEffect } from './pixels';
import { smartStyles as s } from './smart-tools.styles';

type Tool = { id: LocalEffect | 'crop'; label: string; icon: IconName };
const tools: Tool[] = [
  { id: 'enhance', label: 'Автоулучшение', icon: 'sparkles-outline' },
  { id: 'crop', label: 'Подобрать кадр', icon: 'scan-outline' },
  { id: 'sharpen', label: 'Резкость', icon: 'aperture-outline' },
  { id: 'background', label: 'Однотонный фон', icon: 'cut-outline' },
];
const filters: Tool[] = [
  { id: 'gray', label: 'Ч/б', icon: 'contrast-outline' },
  { id: 'sepia', label: 'Сепия', icon: 'sunny-outline' },
  { id: 'contrast', label: 'Контраст', icon: 'options-outline' },
  { id: 'bright', label: 'Светлее', icon: 'sunny-outline' },
  { id: 'blur', label: 'Мягкость', icon: 'water-outline' },
  { id: 'retro', label: 'Ретро', icon: 'film-outline' },
  { id: 'cool', label: 'Прохлада', icon: 'snow-outline' },
];

export function SmartToolsPanel({ quality, disabled, canUndo, onTool, onUndo, onReset, large, lightweight, onLightweight }: {
  quality?: PhotoQuality; disabled: boolean; canUndo: boolean;
  onTool: (tool: LocalEffect | 'crop') => void; onUndo: () => void; onReset: () => void;
  large: boolean; lightweight: boolean; onLightweight: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return <View style={s.panel}>
    <Text style={s.title}>Умные инструменты</Text>
    {(large || lightweight) && <View style={s.quality}><View style={{ flex: 1, gap: 8 }}>
      <Text style={s.hint}>Фото больше 8 Мп: для экономии памяти можно обработать копию до 2000 px. Оригинал сохранится. Разрешение для печати уменьшится.</Text>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: lightweight }} disabled={disabled} style={s.tool} onPress={onLightweight}><Ionicons name={lightweight ? 'checkbox' : 'square-outline'} size={20} color="#EC7777" /><Text style={s.text}>Обрабатывать уменьшенную копию</Text></Pressable>
    </View></View>}
    {quality && <View style={s.quality}>
      <Ionicons name={quality.issues.length ? 'warning-outline' : 'checkmark-circle-outline'} size={20} color={quality.issues.length ? '#F4C98C' : '#A8D9C0'} />
      <View style={{ flex: 1 }}>
        <Text style={s.text}>{quality.issues.length ? quality.issues.join(' · ') : 'Явных проблем не найдено'}</Text>
        <Text style={s.hint}>При 240 dpi: до {quality.maxPrintWidthCm} × {quality.maxPrintHeightCm} см. Оценка приблизительная.</Text>
      </View>
    </View>}
    <View style={s.grid}>{tools.map(tool => <Pressable key={tool.id} accessibilityRole="button" disabled={disabled} onPress={() => onTool(tool.id)} style={[s.tool, s.cell, disabled && s.disabled]}>
      <Ionicons name={tool.icon} size={19} color="#EC7777" /><Text style={s.text}>{tool.label}</Text>
    </Pressable>)}</View>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={s.tool}>
      <Ionicons name="color-filter-outline" size={19} color="#EC7777" /><Text style={s.text}>Фильтры и стили</Text><Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#fff" />
    </Pressable>
    {expanded && <View style={s.grid}>{filters.map(tool => <Pressable key={tool.id} accessibilityRole="button" disabled={disabled} onPress={() => onTool(tool.id)} style={[s.tool, s.cell, disabled && s.disabled]}><Ionicons name={tool.icon} size={16} color="#EC7777" /><Text style={s.text}>{tool.label}</Text></Pressable>)}</View>}
    <Text style={s.hint}>На устройстве, без отправки фото. Свыше 8 Мп обработка идёт по уменьшенной копии (длинная сторона до 2000 px), если не включён явный выбор ниже. Удаление фона подходит для однотонного фона.</Text>
    <View style={s.grid}>
      <Pressable accessibilityRole="button" disabled={disabled || !canUndo} onPress={onUndo} style={[s.tool, s.cell, (!canUndo || disabled) && s.disabled]}><Ionicons name="arrow-undo-outline" size={17} color="#fff" /><Text style={s.text}>Отменить обработку</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={disabled} onPress={onReset} style={[s.tool, s.cell, disabled && s.disabled]}><Text style={s.text}>Вернуть оригинал</Text></Pressable>
    </View>
  </View>;
}
