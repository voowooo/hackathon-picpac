import { POSTER_SIZES, SPREAD_LAYOUTS } from '../../config/catalog';
import { buildSlotIds } from '../../domain/products';
import type { Photo, ProductConfig } from '../../types';

// Match the retained image area and measured quality; never modify originals.
export function makeSmartLayout(cfg: ProductConfig, photos: Photo[]): ProductConfig {
  const available = [...photos];
  const take = (aspect: number) => {
    let index = -1, best = -Infinity;
    available.forEach((p, i) => {
      const ratio = (p.width || 1) / (p.height || 1);
      const score = Math.min(ratio / aspect, aspect / ratio) * .65 + (p.quality?.score ?? 70) / 100 * .35;
      if (score > best) { best = score; index = i; }
    });
    return index < 0 ? undefined : available.splice(index, 1)[0].id;
  };
  const next: ProductConfig = { ...cfg, aiTools: [] };
  if (cfg.category === 'photobook') {
    const [pageWidth, pageHeight] = cfg.bookFormat.split('×').map(Number);
    const pageAspect = pageWidth > 0 && pageHeight > 0 ? pageWidth / pageHeight : 1;
    const slots = [{ id: 'photobook-slot-cover', photoId: take(pageAspect) }];
    const layouts: string[] = [];
    for (let page = 1; page <= cfg.spreads; page++) {
      const wanted = Math.max(2, Math.min(4, Math.ceil(available.length / (cfg.spreads - page + 1))));
      const candidates = SPREAD_LAYOUTS.filter(l => l.cells.length === wanted);
      const layout = candidates.reduce((best, candidate) => {
        const loss = (cells: typeof candidate.cells) => cells.reduce((sum, c, i) => {
          const photo = available[i];
          return sum + Math.abs(Math.log(((photo?.width || 1) / (photo?.height || 1)) / (pageAspect * c.w / c.h)));
        }, 0);
        return loss(candidate.cells) < loss(best.cells) ? candidate : best;
      }, candidates[0] ?? SPREAD_LAYOUTS[0]);
      layouts.push(layout.id);
      layout.cells.forEach((cell, i) => slots.push({ id: `photobook-slot-${page}-${i}`, photoId: take(pageAspect * cell.w / cell.h) }));
    }
    return { ...next, spreadLayouts: layouts, slots };
  }
  next.slots = buildSlotIds(cfg, photos.length).map(id => {
    const previous = cfg.slots.find(s => s.id === id);
    const dimensions = cfg.category === 'poster'
      ? (POSTER_SIZES.find(s => s.id === cfg.posterSizeId)?.id ?? '30x40')
      : previous?.printFormatId ?? cfg.printFormatId;
    const [w, h] = dimensions.split('x').map(Number);
    let aspect = w / h || 2 / 3;
    if (cfg.category === 'poster' && cfg.posterOrientation === 'landscape') aspect = 1 / aspect;
    if (cfg.category === 'postcard') aspect = 1.5;
    return { ...previous, id, photoId: take(aspect) };
  });
  return next;
}
