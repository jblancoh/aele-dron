export const FRAME_COUNT=45;
export function frameIndex(progress:number,count=FRAME_COUNT){return Math.round(Math.max(0,Math.min(1,Number.isFinite(progress)?progress:0))*(count-1));}
export function frameSrc(index:number){return `/media/frames/baner-${String(index+1).padStart(2,'0')}.jpg`;}
