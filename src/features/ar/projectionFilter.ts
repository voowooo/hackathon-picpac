import type { Quad } from './geometry';

/** One shared interpolation factor keeps the four corners coherent. */
export function smoothProjection(previous: Quad | null, target: Quad, seconds: number): Quad {
  if (!previous || seconds > .2) return target;
  const distance = Math.max(...target.map((p,i)=>Math.hypot(p.x-previous[i].x,p.y-previous[i].y)));
  if (distance < .15) return previous;
  const tau = distance > 6 ? .008 : .028;
  const alpha = 1-Math.exp(-Math.max(0,seconds)/tau);
  return target.map((p,i)=>({x:previous[i].x+(p.x-previous[i].x)*alpha,y:previous[i].y+(p.y-previous[i].y)*alpha})) as Quad;
}
