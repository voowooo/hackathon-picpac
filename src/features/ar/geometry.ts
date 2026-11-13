export type Point = { x: number; y: number };
export type Quad = [Point, Point, Point, Point];

export function wallCorners(transform: number[], width: number, height: number): number[][] {
  if (transform.length !== 16 || !transform.every(Number.isFinite) || width <= 0 || height <= 0) throw new Error('Неверная поверхность');
  const length = Math.hypot(transform[4], transform[5], transform[6]);
  if (length < .5 || Math.abs(transform[5] / length) > .45) throw new Error('Наведите камеру на вертикальную стену');
  const n = [transform[4] / length, transform[5] / length, transform[6] / length];
  const horizontal = Math.hypot(n[0], n[2]);
  const r = [n[2] / horizontal, 0, -n[0] / horizontal];
  const up = [n[1] * r[2], n[2] * r[0] - n[0] * r[2], -n[1] * r[0]];
  return [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([x, y]) => {
    const m = [...transform];
    for (let k = 0; k < 3; k++) m[12 + k] += r[k] * x * width / 2 + up[k] * y * height / 2 + n[k] * .002;
    return m;
  });
}

export function quadCenter(q: Quad): Point {
  return { x: q.reduce((n, p) => n + p.x, 0) / 4, y: q.reduce((n, p) => n + p.y, 0) / 4 };
}
export function moveQuad(q: Quad, x: number, y: number): Quad {
  return q.map(p => ({ x: p.x + x, y: p.y + y })) as Quad;
}
export function scaleQuad(q: Quad, scale: number): Quad {
  const c = quadCenter(q);
  return q.map(p => ({ x: c.x + (p.x - c.x) * scale, y: c.y + (p.y - c.y) * scale })) as Quad;
}

/** Project a rectangular print onto four tracked corners, including perspective.
 * Returns a column-major RN/CSS 4x4 matrix, with transform origin at (0, 0). */
export function quadMatrix(q: Quad, width: number, height: number): number[] | null {
  if (width <= 0 || height <= 0 || !q.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x) < 1e7 && Math.abs(p.y) < 1e7)) return null;
  const coordinates = [[0, 0], [width, 0], [width, height], [0, height]];
  const rows: number[][] = [];
  coordinates.forEach(([x, y], i) => {
    const { x: u, y: v } = q[i];
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    rows.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  });
  for (let c = 0; c < 8; c++) {
    let pivot = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(rows[r][c]) > Math.abs(rows[pivot][c])) pivot = r;
    if (Math.abs(rows[pivot][c]) < 1e-9) return null;
    [rows[c], rows[pivot]] = [rows[pivot], rows[c]];
    const divisor = rows[c][c];
    for (let k = c; k < 9; k++) rows[c][k] /= divisor;
    for (let r = 0; r < 8; r++) if (r !== c) {
      const factor = rows[r][c];
      for (let k = c; k < 9; k++) rows[r][k] -= factor * rows[c][k];
    }
  }
  const h = rows.map(row => row[8]);
  return [h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, 1];
}

/** Resize along the poster's local axes, including a rotated print. */
export function resizeQuadDimensions(quad: Quad, horizontal: number, vertical: number): Quad {
  const center=quadCenter(quad);
  const x={x:(quad[1].x-quad[0].x+quad[2].x-quad[3].x)/4,y:(quad[1].y-quad[0].y+quad[2].y-quad[3].y)/4};
  const y={x:(quad[3].x-quad[0].x+quad[2].x-quad[1].x)/4,y:(quad[3].y-quad[0].y+quad[2].y-quad[1].y)/4};
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>({x:center.x+a*x.x*horizontal+b*y.x*vertical,y:center.y+a*x.y*horizontal+b*y.y*vertical})) as Quad;
}
