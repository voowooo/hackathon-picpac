import { Text, TextInput, View } from "react-native";
import { Chip, SettingGroup, Stepper } from '../../../components/ui/index';
import { BOOK_LINES, MAX_SPREADS, MIN_SPREADS, POSTCARD_TEMPLATES, POSTER_SIZES, PRINT_FORMATS } from '../../../config/catalog';
import type { PicPacController } from '../../../state/usePicPacController';
import { styles } from '../../../styles/app.styles';
import { colors } from '../../../styles/theme';
import { money } from '../../../utils/format';
import { renderPrintFinish } from './renderPrintFinish';

export function SettingsPanel({ controller }: { controller: PicPacController }) {
  const { cfg, updateCfg } = controller;

  switch (cfg.category) {
    case "print":
      return (
        <View style={styles.settingsCard}>
          <SettingGroup title="Формат">
            {PRINT_FORMATS.map((f) => (
              <Chip key={f.id} label={`${f.label} · ${money(f.pricePer)}`} active={cfg.printFormatId === f.id} onPress={() => updateCfg({ printFormatId: f.id })} />
            ))}
          </SettingGroup>
          <SettingGroup title="Бумага">
            <Chip label="Матовая" active={cfg.paper === "matte"} onPress={() => updateCfg({ paper: "matte" })} />
            <Chip label="Глянцевая" active={cfg.paper === "glossy"} onPress={() => updateCfg({ paper: "glossy" })} />
          </SettingGroup>
          <SettingGroup title="Копий каждого кадра">
            {[1, 2, 3].map((n) => (
              <Chip key={n} label={`×${n}`} active={cfg.copies === n} onPress={() => updateCfg({ copies: n })} />
            ))}
          </SettingGroup>
          {renderPrintFinish(controller, "print")}
        </View>
      );
    case "photobook": {
      const line = BOOK_LINES.find((l) => l.id === cfg.bookLineId);
      return (
        <View style={styles.settingsCard}>
          <SettingGroup title="Линейка" hint={line?.desc}>
            {BOOK_LINES.map((l) => (
              <Chip
                key={l.id} label={l.name} active={cfg.bookLineId === l.id}
                onPress={() => updateCfg({ bookLineId: l.id, bookFormat: l.formats.includes(cfg.bookFormat) ? cfg.bookFormat : l.formats[0] })}
              />
            ))}
          </SettingGroup>
          <SettingGroup title="Формат">
            {line?.formats.map((f) => (
              <Chip key={f} label={f} active={cfg.bookFormat === f} onPress={() => updateCfg({ bookFormat: f })} />
            ))}
          </SettingGroup>
          <View style={styles.settingGroup}>
            <Text style={styles.settingGroupTitle}>Объём</Text>
            <Text style={styles.settingGroupHint}>Больше разворотов — больше фото в книге</Text>
            <Stepper
              label={`${cfg.spreads} разворотов · ${cfg.spreads * 2 + 2} стр.`}
              onMinus={() => updateCfg({ spreads: cfg.spreads - 1 })} onPlus={() => updateCfg({ spreads: cfg.spreads + 1 })}
              minusDisabled={cfg.spreads <= MIN_SPREADS} plusDisabled={cfg.spreads >= MAX_SPREADS}
            />
          </View>
          <SettingGroup title="Стиль обложки" hint={cfg.coverStyle === "framed" ? "Фото в рамке" : "Фото на всю обложку"}>
            <Chip label="Фото" active={cfg.coverStyle !== "framed"} onPress={() => updateCfg({ coverStyle: "full" })} />
            <Chip label="Фото в рамке" active={cfg.coverStyle === "framed"} onPress={() => updateCfg({ coverStyle: "framed" })} />
          </SettingGroup>
        </View>
      );
    }
    case "poster":
      return (
        <View style={styles.settingsCard}>
          <SettingGroup title="Ориентация">
            <Chip label="Вертикальный" active={cfg.posterOrientation === "portrait"} onPress={() => updateCfg({ posterOrientation: "portrait" })} />
            <Chip label="Горизонтальный" active={cfg.posterOrientation === "landscape"} onPress={() => updateCfg({ posterOrientation: "landscape" })} />
          </SettingGroup>
          <SettingGroup title="Размер">
            {POSTER_SIZES.map((s) => (
              <Chip key={s.id} label={`${s.label} · ${money(s.price)}`} active={cfg.posterSizeId === s.id} onPress={() => updateCfg({ posterSizeId: s.id })} />
            ))}
          </SettingGroup>
          {renderPrintFinish(controller, "poster")}
        </View>
      );
    case "postcard":
      return (
        <View style={styles.settingsCard}>
          <Text style={styles.inputLabel}>Подпись на обороте</Text>
          <TextInput
            style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]} value={cfg.postcardCaption}
            onChangeText={(t) => updateCfg({ postcardCaption: t })} placeholder="Тёплые слова для близкого человека"
            placeholderTextColor={colors.textSecondary} multiline maxLength={120}
          />
          <SettingGroup title="Стиль">
            {POSTCARD_TEMPLATES.map((t) => (
              <Chip key={t.id} label={t.name} active={cfg.postcardTemplateId === t.id} onPress={() => updateCfg({ postcardTemplateId: t.id })} />
            ))}
          </SettingGroup>
          <SettingGroup title="Количество">
            {[1, 5, 10].map((n) => (
              <Chip key={n} label={`${n} шт`} active={cfg.copies === n} onPress={() => updateCfg({ copies: n })} />
            ))}
          </SettingGroup>
        </View>
      );
    default:
      return null;
  }

}
