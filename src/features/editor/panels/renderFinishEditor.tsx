import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { Chip, SettingGroup } from '../../../components/ui/index';
import { PRINT_COLORS } from '../../../config/catalog';
import { styles } from '../../../styles/app.styles';
import { PrintFinish } from '../../../types/index';
import { hexColorsEqual, isDark, normalizeHexColor } from '../../../utils/format';

export function renderFinishEditor(finish: PrintFinish, update: (patch: Partial<PrintFinish>) => void, category: "print" | "poster") {

  const margins = category === "print" ? [0, 2, 5, 10, 20] : [0, 10, 20, 40, 60];
  const frames = category === "print" ? [0, 1, 2, 4] : [0, 3, 6, 10];
  const colorsFor = (kind: "marginColor" | "frameColor", title: string) => {
    const current = normalizeHexColor(finish[kind], kind === "marginColor" ? "#FFFFFF" : "#25382E");
    return (
      <View style={styles.finishColors}>
        {PRINT_COLORS.map((color) => (
          <Pressable
            key={color.value} accessibilityRole="button" accessibilityLabel={`${title} · ${color.name}`}
            accessibilityState={{ selected: hexColorsEqual(finish[kind], color.value) }}
            onPress={() => update({ [kind]: color.value })}
            style={[styles.finishSwatch, { backgroundColor: color.value }, hexColorsEqual(finish[kind], color.value) && styles.finishSwatchSelected]}
          >
            {hexColorsEqual(finish[kind], color.value) && <Ionicons name="checkmark" size={18} color={isDark(color.value) ? "#fff" : "#20372b"} />}
          </Pressable>
        ))}
        {!PRINT_COLORS.some(color => hexColorsEqual(finish[kind], color.value)) ? (
          <View style={[styles.finishSwatch, { backgroundColor: current }, styles.finishSwatchSelected]}>
            <Ionicons name="checkmark" size={18} color={isDark(current) ? "#fff" : "#20372b"} />
          </View>
        ) : null}
      </View>
    );
  };
  return (
    <>
      <SettingGroup title="Поля">
        {margins.map((mm) => (
          <Chip
            key={mm}
            label={mm === 0 ? "Без полей" : `${mm} мм`}
            active={finish.margin === mm}
            onPress={() => update(mm === 0 ? { margin: mm } : { margin: mm, marginColor: finish.marginColor || "#FFFFFF" })}
          />
        ))}
      </SettingGroup>
      {finish.margin > 0 && (
        <View style={styles.finishColorGroup}>
          <Text style={styles.inputLabel}>Цвет полей</Text>
          {colorsFor("marginColor", "Цвет полей")}
        </View>
      )}
      <SettingGroup title="Рамка" hint="Цветная линия вокруг снимка">
        {frames.map((mm) => (
          <Chip
            key={mm}
            label={mm === 0 ? "Без рамки" : `${mm} мм`}
            active={finish.frame === mm}
            onPress={() => update(mm === 0 ? { frame: mm } : { frame: mm, frameColor: finish.frameColor || "#25382E" })}
          />
        ))}
      </SettingGroup>
      {finish.frame > 0 && (
        <View style={styles.finishColorGroup}>
          <Text style={styles.inputLabel}>Цвет рамки</Text>
          {colorsFor("frameColor", "Цвет рамки")}
        </View>
      )}
    </>
  );

}
