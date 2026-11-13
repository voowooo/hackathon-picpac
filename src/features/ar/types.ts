import type { PrintFinish } from '../../types';
export type PosterSceneProps = { photoUri?: string; widthCm: number; heightCm: number; finish: PrintFinish; onClose: () => void };
