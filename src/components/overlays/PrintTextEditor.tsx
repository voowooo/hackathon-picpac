import { Ionicons } from "@expo/vector-icons";
import React, { useRef } from "react";
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from '../../styles/app.styles';
import { colors } from '../../styles/theme';
import { PrimaryButton } from '../ui/index';

export function PrintTextEditor({ visible, field, value, onChange, onClose, onSave }: {
  visible: boolean; field: "postcardCaption" | "bookTitle"; value: string;
  onChange: (value: string) => void; onClose: () => void; onSave: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const close = () => { Keyboard.dismiss(); onClose(); };
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={close} onShow={() => input.current?.focus()}>
      <View style={[styles.flex, { backgroundColor: "rgba(20,32,26,.42)" }]}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 20, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}>
            <View style={[styles.textEditorCard, { width: "100%", maxWidth: 480, alignSelf: "center" }]} accessibilityViewIsModal>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <Text style={styles.settingsTitle}>{field === "bookTitle" ? "Название альбома" : "Текст открытки"}</Text>
                <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Закрыть редактор текста" hitSlop={10} style={{ minWidth: 36, minHeight: 36, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="close" size={22} color={colors.text} />
                </Pressable>
              </View>
              <TextInput
                ref={input} multiline value={value} onChangeText={onChange} accessibilityLabel="Текст для печати"
                placeholder="Напишите что-нибудь тёплое" placeholderTextColor={colors.textSecondary}
                maxLength={field === "bookTitle" ? 40 : 120} style={[styles.textEditorInput, { maxHeight: Math.min(220, height * 0.3) }]}
              />
              <View style={styles.textEditorActions}>
                <PrimaryButton label="Сохранить текст" onPress={() => { Keyboard.dismiss(); onSave(); }} />
                <Pressable style={styles.zoomButton} accessibilityRole="button" onPress={close}>
                  <Text style={styles.linkText}>Отмена</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
