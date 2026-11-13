import type { Point, Quad } from './geometry';

export type Quaternion = { x: number; y: number; z: number; w: number };
export type Vector3 = { x: number; y: number; z: number };
export type RayQuad = [Vector3, Vector3, Vector3, Vector3];
export const identityRotation = (): Quaternion => ({ x: 0, y: 0, z: 0, w: 1 });

export function integrateGyroscope(q: Quaternion, rate: Vector3, seconds: number): Quaternion {
  if (seconds <= 0 || seconds > .3 || ![rate.x, rate.y, rate.z, seconds].every(Number.isFinite)) return q;
  const speed = Math.hypot(rate.x, rate.y, rate.z);
  if (speed < 1e-12) return q;
  const half = speed * seconds / 2, s = Math.sin(half) / speed;
  const d = { x: rate.x * s, y: rate.y * s, z: rate.z * s, w: Math.cos(half) };
  const next = {
    x: q.w * d.x + q.x * d.w + q.y * d.z - q.z * d.y,
    y: q.w * d.y - q.x * d.z + q.y * d.w + q.z * d.x,
    z: q.w * d.z + q.x * d.y - q.y * d.x + q.z * d.w,
    w: q.w * d.w - q.x * d.x - q.y * d.y - q.z * d.z,
  };
  const length = Math.hypot(next.x, next.y, next.z, next.w);
  return { x: next.x / length, y: next.y / length, z: next.z / length, w: next.w / length };
}

function rotate(q: Quaternion, v: Vector3): Vector3 {
  const tx = 2 * (q.y * v.z - q.z * v.y), ty = 2 * (q.z * v.x - q.x * v.z), tz = 2 * (q.x * v.y - q.y * v.x);
  return { x: v.x + q.w * tx + q.y * tz - q.z * ty, y: v.y + q.w * ty + q.z * tx - q.x * tz, z: v.z + q.w * tz + q.x * ty - q.y * tx };
}
// Keep the original preview gain. A guessed long-axis camera FOV nearly doubled
// the displacement on portrait phones; real intrinsics are unavailable in CameraView.
export const previewFocal = (width: number, _height: number) => width / (2 * Math.tan(Math.PI / 6));

// Rays are fixed in a local orientation frame at placement time, not in screen
// pixels. Reprojection compensates yaw, pitch and roll without Euler singularities.
export function anchorRays(quad: Quad, q: Quaternion, width: number, height: number): RayQuad {
  const f = previewFocal(width, height);
  return quad.map(p => rotate(q, { x: (p.x - width / 2) / f, y: -(p.y - height / 2) / f, z: -1 })) as RayQuad;
}
export function projectRays(rays: RayQuad, q: Quaternion, width: number, height: number): Quad | null {
  const inverse = { x: -q.x, y: -q.y, z: -q.z, w: q.w }, f = previewFocal(width, height);
  const points: Point[] = [];
  for (const ray of rays) {
    const v = rotate(inverse, ray);
    if (v.z >= -.08) return null;
    const x = width / 2 + f * v.x / -v.z, y = height / 2 - f * v.y / -v.z;
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > width * 50 || Math.abs(y) > height * 50) return null;
    points.push({ x, y });
  }
  return points as Quad;
}
export function resizeRays(rays: RayQuad, factor: number): RayQuad {
  const center = rays.reduce((c, p) => ({ x: c.x + p.x / 4, y: c.y + p.y / 4, z: c.z + p.z / 4 }), { x: 0, y: 0, z: 0 });
  return rays.map(p => ({ x: center.x + (p.x - center.x) * factor, y: center.y + (p.y - center.y) * factor, z: center.z + (p.z - center.z) * factor })) as RayQuad;
}

/** Shortest-path quaternion filtering: no Euler wrap jumps, almost no lag while moving. */
export function smoothRotation(previous: Quaternion, target: Quaternion, seconds: number): Quaternion {
  let dot = previous.x*target.x+previous.y*target.y+previous.z*target.z+previous.w*target.w;
  const sign = dot < 0 ? -1 : 1;
  dot = Math.min(1, Math.abs(dot));
  const angle = 2*Math.acos(dot);
  if (angle < .00035) return previous;
  const tau = angle > .025 ? .006 : .018;
  const a = 1-Math.exp(-Math.max(0, Math.min(.1, seconds))/tau);
  const q = { x: previous.x*(1-a)+target.x*a*sign, y: previous.y*(1-a)+target.y*a*sign,
    z: previous.z*(1-a)+target.z*a*sign, w: previous.w*(1-a)+target.w*a*sign };
  const n = Math.hypot(q.x,q.y,q.z,q.w);
  return { x:q.x/n, y:q.y/n, z:q.z/n, w:q.w/n };
}

/** Rotation-only preview has no depth estimate: preserve the placed size instead of
 * stretching four independent rays toward infinity at the edge of the camera. */
export function projectStablePoster(rays: RayQuad, rotation: Quaternion, width: number, height: number, placed: Quad): Quad | null {
  const centerRays = resizeRays(rays, 0);
  const center = projectRays(centerRays, rotation, width, height)?.[0];
  if (!center || center.x < -width || center.x > width*2 || center.y < -height || center.y > height*2) return null;
  const original = placed.reduce((c,p)=>({x:c.x+p.x/4,y:c.y+p.y/4}),{x:0,y:0});
  // Closest in-plane rotation of the camera-space basis. Perspective slopes
  // from an off-center top edge must not turn yaw/pitch into apparent roll.
  const inverse={x:-rotation.x,y:-rotation.y,z:-rotation.z,w:rotation.w};
  const basis=(a:Vector3,b:Vector3)=>{const length=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);return rotate(inverse,{x:(b.x-a.x)/length,y:(b.y-a.y)/length,z:(b.z-a.z)/length});};
  const right=basis(rays[0],rays[1]),down=basis(rays[0],rays[3]);
  const angle = Math.atan2(-right.y-down.x,right.x-down.y)-Math.atan2(placed[1].y-placed[0].y,placed[1].x-placed[0].x);
  const c=Math.cos(angle),s=Math.sin(angle);
  return placed.map(p=>({x:center.x+(p.x-original.x)*c-(p.y-original.y)*s,y:center.y+(p.x-original.x)*s+(p.y-original.y)*c})) as Quad;
}

export function resizeRayDimensions(rays: RayQuad, horizontal: number, vertical: number): RayQuad {
  const center=resizeRays(rays,0)[0];
  const axis=(a:number,b:number,c:number,d:number)=>({x:(rays[a].x-rays[b].x+rays[c].x-rays[d].x)/4,y:(rays[a].y-rays[b].y+rays[c].y-rays[d].y)/4,z:(rays[a].z-rays[b].z+rays[c].z-rays[d].z)/4});
  const x=axis(1,0,2,3),y=axis(3,0,2,1);
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>({x:center.x+a*x.x*horizontal+b*y.x*vertical,y:center.y+a*x.y*horizontal+b*y.y*vertical,z:center.z+a*x.z*horizontal+b*y.z*vertical})) as RayQuad;
}
