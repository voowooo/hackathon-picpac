import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { IconName } from '../../types';
import type { LocalEffect } from './pixels';
import { smartStyles as s } from './smart-tools.styles';

type Tool = { id: LocalEffect | 'crop'; label: string; hint: string; icon: IconName };
const corrections: Tool[] = [
  { id: 'enhance', label: 'Авто', hint: 'Свет и цвет', icon: 'sparkles-outline' },
  { id: 'bright', label: 'Светлее', hint: 'Мягкая экспозиция', icon: 'sunny-outline' },
  { id: 'sharpen', label: 'Резкость', hint: 'Выразить детали', icon: 'aperture-outline' },
  { id: 'contrast', label: 'Контраст', hint: 'Глубина тонов', icon: 'contrast-outline' },
  { id: 'crop', label: 'Умный кадр', hint: 'По формату печати', icon: 'scan-outline' },
  { id: 'background', label: 'Убрать фон', hint: 'Для однотонного фона', icon: 'cut-outline' },
];
const filters: Tool[] = [
  { id: 'gray', label: 'Ч/б', hint: 'Монохром', icon: 'contrast-outline' },
  { id: 'sepia', label: 'Сепия', hint: 'Тёплая классика', icon: 'sunny-outline' },
  { id: 'retro', label: 'Ретро', hint: 'Плёночные тона', icon: 'film-outline' },
  { id: 'cool', label: 'Прохлада', hint: 'Холодные оттенки', icon: 'snow-outline' },
  { id: 'blur', label: 'Мягкость', hint: 'Плавное размытие', icon: 'water-outline' },
];

export function SmartToolsPanel({ disabled, active, onTool }: {
  disabled: boolean; active: string[];
  onTool: (tool: LocalEffect | 'crop') => void;
}) {
  const [tab, setTab] = useState<'correction' | 'filters'>('correction');
  return <View style={s.panel}>
    <View style={s.tabs}>{(['correction', 'filters'] as const).map(id => <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: tab === id }} onPress={() => setTab(id)} style={[s.tab, tab === id && s.tabOn]}><Text style={[s.tabText, tab === id && s.tabTextOn]}>{id === 'correction' ? 'Коррекция' : 'Фильтры'}</Text></Pressable>)}</View>
    <Text style={s.hint}>Нажмите для применения. Ещё раз — чтобы убрать.</Text>
    <View style={s.grid}>{(tab === 'correction' ? corrections : filters).map(tool => {
      const selected = active.includes(tool.id);
      return <Pressable key={tool.id} accessibilityRole="button" accessibilityLabel={tool.label} aria-pressed={selected} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={() => onTool(tool.id)} style={[s.tool, s.cell, selected && s.toolOn, disabled && s.disabled]}>
        <View style={[s.toolIcon, selected && s.toolIconOn]}><Ionicons name={tool.icon} size={22} color={selected ? '#fff' : '#364C49'} /></View>
        <Text style={s.text}>{tool.label}</Text><Text style={s.toolHint}>{tool.hint}</Text>
        {selected && <Ionicons name="checkmark-circle" size={16} color="#DD5757" style={s.selected} />}
      </Pressable>;
    })}</View>
    <Text style={s.privacy}>Обработка на устройстве · без отправки фото</Text>
  </View>;
}
