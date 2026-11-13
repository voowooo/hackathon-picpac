import { POSTER_SIZES } from '../../config/catalog';
export type PosterFormat = { id: string; widthCm: number; heightCm: number };
export function posterFormats(landscape: boolean): PosterFormat[] {
  return POSTER_SIZES.map(({id})=>{
    const [w,h]=id.split('x').map(Number);
    return {id,widthCm:landscape?h:w,heightCm:landscape?w:h};
  });
}
export function selectedPosterFormat(id: string, landscape: boolean) {
  const formats=posterFormats(landscape);
  return formats.find(f=>f.id===id)??formats[0];
}
export function adjacentPosterFormat(id: string, direction: -1 | 1, landscape: boolean) {
  const formats=posterFormats(landscape),index=Math.max(0,formats.findIndex(f=>f.id===id));
  return formats[Math.max(0,Math.min(formats.length-1,index+direction))];
}
