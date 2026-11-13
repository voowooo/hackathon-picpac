export type HSV = { h: number; s: number; v: number };
const clamp = (n: number) => Math.max(0, Math.min(1, n));
export function hsvToHex({ h, s, v }: HSV) {
  const hue = ((h % 360) + 360) % 360 / 60, c = clamp(v) * clamp(s), x = c * (1 - Math.abs(hue % 2 - 1)), m = clamp(v) - c;
  const rgb = hue < 1 ? [c,x,0] : hue < 2 ? [x,c,0] : hue < 3 ? [0,c,x] : hue < 4 ? [0,x,c] : hue < 5 ? [x,0,c] : [c,0,x];
  return '#' + rgb.map(n=>Math.round((n+m)*255).toString(16).padStart(2,'0')).join('').toUpperCase();
}
export function hexToHsv(hex: string): HSV {
  let value = hex.replace('#','');
  if(value.length===3) value=value.split('').map(c=>c+c).join('');
  if(!/^[\da-f]{6}$/i.test(value)) return {h:0,s:0,v:1};
  const [r,g,b]=[0,2,4].map(i=>parseInt(value.slice(i,i+2),16)/255), max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
  const h=!d ? 0 : max===r ? 60*((g-b)/d%6) : max===g ? 60*((b-r)/d+2) : 60*((r-g)/d+4);
  return {h:(h+360)%360,s:max ? d/max : 0,v:max};
}
export function wheelColor(x: number, y: number, size: number) {
  const dx=x-size/2,dy=y-size/2,r=size/2-12;
  return {h:(Math.atan2(dy,dx)*180/Math.PI+360)%360,s:clamp(Math.hypot(dx,dy)/r)};
}
