import { useCallback, useEffect, useRef } from 'react';
import type { Quad } from './geometry';
import { smoothProjection } from './projectionFilter';

/** Smooth the native module's ~30 Hz projections on display frames, without extrapolating stale poses. */
export function useProjectionFrames(onFrame: (quad: Quad | null) => void) {
  const callback = useRef(onFrame);
  useEffect(() => { callback.current = onFrame; }, [onFrame]);
  const live = useRef({ target: null as Quad | null, shown: null as Quad | null, frame: 0, last: 0 });
  useEffect(() => () => { if(live.current.frame) cancelAnimationFrame(live.current.frame); }, []);
  return useCallback((target: Quad | null, immediate = false) => {
    const l=live.current; l.target=target;
    if (!target || immediate) {
      if(l.frame) cancelAnimationFrame(l.frame);
      l.frame=0; l.last=0; l.shown=target; callback.current(target); return;
    }
    if(l.frame) return;
    const render=(time: number) => {
      l.frame=0;
      if(!l.target) return;
      const next=smoothProjection(l.shown,l.target,l.last ? (time-l.last)/1000 : 1/60);
      l.last=time;
      if(next !== l.shown) {l.shown=next;callback.current(next);l.frame=requestAnimationFrame(render);}
    };
    l.frame=requestAnimationFrame(render);
  }, []);
}
