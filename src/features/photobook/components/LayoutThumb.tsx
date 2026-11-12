import { View } from "react-native";
import { styles } from '../../../styles/app.styles';
import { SpreadLayout } from '../../../types/index';

// ═══════════════════════════ Редактор ═══════════════════════════
// Мини-схема сетки разворота: две страницы с затемнёнными ячейками под фото.
export function LayoutThumb({ layout }: { layout: SpreadLayout }) {
  return (
    <View style={styles.layoutThumb}>
      {layout.cells.map((c, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: `${c.x * 50}%`, top: `${c.y * 100}%`,
            width: `${c.w * 50}%`, height: `${c.h * 100}%`,
            backgroundColor: "#D8E2D6", borderWidth: 1, borderColor: "#B9C8B9",
          }}
        />
      ))}
      <View style={styles.layoutThumbFold} />
    </View>
  );
}
