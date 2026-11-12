import { createContext, useContext, useEffect, type ReactNode } from "react";
import { preloadHomeHeroImages } from "../assets/homeHero";
import { usePicPacController, type PicPacController } from "./usePicPacController";

const PicPacContext = createContext<PicPacController | null>(null);

export function PicPacProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    void preloadHomeHeroImages();
  }, []);

  const controller = usePicPacController();
  return <PicPacContext.Provider value={controller}>{children}</PicPacContext.Provider>;
}

export function usePicPac(): PicPacController {
  const controller = useContext(PicPacContext);
  if (!controller) throw new Error("usePicPac must be used inside PicPacProvider");
  return controller;
}
