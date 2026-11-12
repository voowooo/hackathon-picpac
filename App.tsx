import type { ReactNode } from "react";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { PicPacShell } from "./src/application/PicPacShell";
import "./src/services/platform";
import { PicPacProvider } from "./src/state/PicPacProvider";
import { styles } from "./src/styles/app.styles";

export default function App({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={[]}>
        <PicPacProvider>
          <PicPacShell>{children}</PicPacShell>
        </PicPacProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
