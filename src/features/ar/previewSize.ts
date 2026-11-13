export type PreviewSize = { widthCm: number; heightCm: number };
export const MIN_PREVIEW_CM = 5;
export const MAX_PREVIEW_CM = 150;
export function stepPreviewSize(current: PreviewSize, reference: PreviewSize, direction: -1 | 1, steps = 1): PreviewSize {
  const short = Math.min(current.widthCm,current.heightCm);
  const next=Math.max(MIN_PREVIEW_CM,Math.min(MAX_PREVIEW_CM,Math.round(short)+direction*Math.max(1,Math.min(5,Math.round(steps)))));
  const basis=Math.min(reference.widthCm,reference.heightCm);
  return {widthCm:reference.widthCm*next/basis,heightCm:reference.heightCm*next/basis};
}
export const samePreviewSize = (a: PreviewSize,b: PreviewSize) => Math.abs(a.widthCm-b.widthCm)<1e-7&&Math.abs(a.heightCm-b.heightCm)<1e-7;
export const displayCentimeters = (cm: number) => Number(cm.toFixed(1)).toString().replace('.',',');
