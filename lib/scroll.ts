export const FRAME_COUNT=45;
const clampProgress=(progress:number)=>Math.max(0,Math.min(1,Number.isFinite(progress)?progress:0));
export function frameSrc(index:number){return `/media/frames/baner-${String(index+1).padStart(2,'0')}.jpg`;}
/** Frames surrounding a fractional position, with `mix` as the weight of `to` for a crossfade. */
export function frameBlend(progress:number,count=FRAME_COUNT){const position=clampProgress(progress)*(count-1);const from=Math.min(count-1,Math.floor(position));const to=Math.min(count-1,from+1);return {from,to,mix:from===to?0:position-from};}
// Time constant of the scroll inertia: the sequence trails the scrollbar slightly instead of jumping.
const EASE_MS=140;
/** Exponential approach toward `target`, independent of frame rate; snaps once visually settled. */
export function easeToward(current:number,target:number,elapsedMs:number){const next=current+(target-current)*(1-Math.exp(-Math.max(0,elapsedMs)/EASE_MS));return Math.abs(target-next)<0.0005?target:next;}
